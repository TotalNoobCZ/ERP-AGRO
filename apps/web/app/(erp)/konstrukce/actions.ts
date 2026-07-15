"use server";
// ----------------------------------------------------------------------------
//  Server actions modulu Konstrukce (dle ZADANI.md).
//  Projekty VŽDY patří k zakázce (projects.zakazka_id NOT NULL – integrace ERP).
//  Kolize (kap. 9): jakýkoliv vizuální překryv úkol×úkol / úkol×absence na ose
//  člověka se VŽDY nahlásí; uložit lze i tak (rozhoduje člověk, vynutit=true).
// ----------------------------------------------------------------------------
import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { canWrite, rangesOverlap, workdaysBetween, ABSENCE_LABELS, type AbsenceType, type Role } from "@erp/core";

type Db = Awaited<ReturnType<typeof createClient>>;

export type Kolize = {
  s: string; // s čím se překrývá (název úkolu / typ absence)
  od: string; // překryv od (YYYY-MM-DD)
  do: string; // překryv do
};

export type KVysledek = { ok: boolean; chyba?: string; kolize?: Kolize[] };

async function writer() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!canWrite(profile.role as Role)) return null;
  return { id: profile.id, name: profile.name };
}

function refreshKonstrukce() {
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/archiv");
}

/**
 * Najde překryvy nového rozpětí s úkoly a absencemi daného člena.
 * (kap. 9: hlásí se vždy, bez ohledu na trvání či volný prostor.)
 */
async function najdiKolizeClena(
  supabase: Db,
  memberId: string,
  start: string,
  end: string,
  excludeTaskId?: string,
): Promise<Kolize[]> {
  const range = { start, end };
  const kolize: Kolize[] = [];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, name, start_date, end_date")
    .eq("assignee_id", memberId)
    .eq("status", "active")
    .eq("completed", false)
    .not("start_date", "is", null)
    .not("end_date", "is", null);
  for (const t of tasks ?? []) {
    if (excludeTaskId && t.id === excludeTaskId) continue;
    const other = { start: t.start_date!, end: t.end_date! };
    if (rangesOverlap(range, other)) {
      kolize.push({
        s: `úkol „${t.name}“ (${other.start} – ${other.end})`,
        od: range.start > other.start ? range.start : other.start,
        do: range.end < other.end ? range.end : other.end,
      });
    }
  }

  const { data: absences } = await supabase
    .from("absences")
    .select("type, start_date, end_date")
    .eq("profile_id", memberId);
  for (const a of absences ?? []) {
    const other = { start: a.start_date, end: a.end_date };
    if (rangesOverlap(range, other)) {
      kolize.push({
        s: `absence ${ABSENCE_LABELS[a.type as AbsenceType]} (${other.start} – ${other.end})`,
        od: range.start > other.start ? range.start : other.start,
        do: range.end < other.end ? range.end : other.end,
      });
    }
  }
  return kolize;
}

// ---- Projekty ---------------------------------------------------------------

export async function vytvoritProjekt(
  zakazkaId: string,
  name: string,
): Promise<{ ok: boolean; chyba?: string; id?: string }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  if (!name.trim()) return { ok: false, chyba: "Zadejte název projektu." };
  if (!zakazkaId) return { ok: false, chyba: "Projekt musí patřit k zakázce." };
  const supabase = await createClient();

  const { data: z } = await supabase
    .from("zakazky").select("id, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { ok: false, chyba: "Zakázka nenalezena." };

  const { data, error } = await supabase
    .from("projects")
    .insert({ zakazka_id: zakazkaId, name: name.trim() })
    .select("id")
    .single();
  if (error || !data) return { ok: false, chyba: "Projekt se nepodařilo založit." };
  refreshKonstrukce();
  revalidatePath(`/zakazky/${zakazkaId}`);
  return { ok: true, id: data.id };
}

export async function upravitProjekt(
  id: string,
  patch: { name?: string; ownerId?: string | null },
): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  const update: { name?: string; owner_id?: string | null } = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) return { ok: false, chyba: "Název nesmí být prázdný." };
    update.name = patch.name.trim();
  }
  if (patch.ownerId !== undefined) update.owner_id = patch.ownerId || null;
  const { error } = await supabase.from("projects").update(update).eq("id", id);
  if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

/** „Vyčistit“ – přesune všechny splněné úkoly projektu do archivu. */
export async function vycistitProjekt(id: string): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "archived", archived_by: u.id, archived_at: now })
    .eq("project_id", id)
    .eq("status", "active")
    .eq("completed", true);
  if (error) return { ok: false, chyba: "Vyčištění se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

/** „Archivovat“ – celý projekt; jen když jsou všechny jeho úkoly splněné. */
export async function archivovatProjekt(id: string): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();

  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("status", "active")
    .eq("completed", false);
  if (count && count > 0) {
    return { ok: false, chyba: `Projekt nelze archivovat – má ${count} nesplněných úkolů.` };
  }

  const now = new Date().toISOString();
  // Sloučení: archivují se i dosud aktivní (splněné) úkoly projektu.
  await supabase
    .from("tasks")
    .update({ status: "archived", archived_by: u.id, archived_at: now })
    .eq("project_id", id)
    .eq("status", "active");
  const { error } = await supabase
    .from("projects")
    .update({ status: "archived", archived_by: u.id, archived_at: now })
    .eq("id", id);
  if (error) return { ok: false, chyba: "Archivace se nezdařila." };
  refreshKonstrukce();
  return { ok: true };
}

// ---- Úkoly -------------------------------------------------------------------

export async function vytvoritUkol(
  projectId: string,
  name: string,
): Promise<{ ok: boolean; chyba?: string; id?: string }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  if (!name.trim()) return { ok: false, chyba: "Zadejte název úkolu." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ project_id: projectId, name: name.trim() })
    .select("id")
    .single();
  if (error || !data) return { ok: false, chyba: "Úkol se nepodařilo založit." };
  refreshKonstrukce();
  return { ok: true, id: data.id };
}

export type UkolPatch = {
  name?: string;
  assigneeId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
  completed?: boolean;
};

/**
 * Uloží změny úkolu. Když má úkol po změně řešitele a termíny, zkontroluje
 * překryvy na ose řešitele – bez `vynutit` vrátí kolize a NEuloží.
 */
export async function upravitUkol(id: string, patch: UkolPatch, vynutit = false): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tasks")
    .select("id, name, assignee_id, start_date, end_date, duration_days, completed, status")
    .eq("id", id)
    .maybeSingle();
  if (!t) return { ok: false, chyba: "Úkol nenalezen." };

  const assignee = patch.assigneeId !== undefined ? patch.assigneeId : t.assignee_id;
  const start = patch.startDate !== undefined ? patch.startDate : t.start_date;
  const end = patch.endDate !== undefined ? patch.endDate : t.end_date;
  const completed = patch.completed !== undefined ? patch.completed : t.completed;

  if (start && end && start > end) return { ok: false, chyba: "Konec nesmí být před začátkem." };

  // Kolize se testuje jen u nesplněného úkolu s řešitelem a termíny.
  if (!vynutit && assignee && start && end && !completed) {
    const kolize = await najdiKolizeClena(supabase, assignee, start, end, id);
    if (kolize.length > 0) return { ok: false, kolize };
  }

  const update: {
    name?: string;
    assignee_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    duration_days?: number | null;
    completed?: boolean;
    completed_at?: string | null;
  } = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) return { ok: false, chyba: "Název nesmí být prázdný." };
    update.name = patch.name.trim();
  }
  if (patch.assigneeId !== undefined) update.assignee_id = patch.assigneeId || null;
  if (patch.startDate !== undefined) update.start_date = patch.startDate || null;
  if (patch.endDate !== undefined) update.end_date = patch.endDate || null;
  if (patch.durationDays !== undefined) update.duration_days = patch.durationDays;
  if (patch.completed !== undefined) {
    update.completed = patch.completed;
    update.completed_at = patch.completed ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from("tasks").update(update).eq("id", id);
  if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

/**
 * Posun/roztažení úkolu v Ganttu: nové kalendářní rozpětí; Trvání se
 * přepočítá na pracovní dny uvnitř rozpětí. Kolize jako u upravitUkol.
 */
export async function posunoutUkol(
  id: string,
  start: string,
  end: string,
  vynutit = false,
): Promise<KVysledek> {
  if (start > end) return { ok: false, chyba: "Konec nesmí být před začátkem." };
  return upravitUkol(id, { startDate: start, endDate: end, durationDays: workdaysBetween(start, end) }, vynutit);
}

/** Přeuspořádání úkolů v dlaždici člena (pořadí řádků v Ganttu). */
export async function seraditUkoly(orderedIds: string[]): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from("tasks").update({ order_in_member: i }).eq("id", orderedIds[i]!);
  }
  refreshKonstrukce();
  return { ok: true };
}

// ---- Poznámky a todo (úkol i projekt) ---------------------------------------

export async function pridatPoznamkuK(
  cil: "task" | "project",
  cilId: string,
  body: string,
): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  if (!body.trim()) return { ok: false, chyba: "Poznámka je prázdná." };
  const supabase = await createClient();
  const { error } =
    cil === "task"
      ? await supabase.from("task_notes").insert({ task_id: cilId, author_id: u.id, body: body.trim() })
      : await supabase.from("project_notes").insert({ project_id: cilId, author_id: u.id, body: body.trim() });
  if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

export async function pridatTodo(cil: "task" | "project", cilId: string, body: string): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  if (!body.trim()) return { ok: false, chyba: "Prázdná položka." };
  const supabase = await createClient();
  const { error } =
    cil === "task"
      ? await supabase.from("task_todos").insert({ task_id: cilId, body: body.trim() })
      : await supabase.from("project_todos").insert({ project_id: cilId, body: body.trim() });
  if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

export async function prepnoutTodo(cil: "task" | "project", todoId: string, done: boolean): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  const table = cil === "task" ? "task_todos" : "project_todos";
  const { error } = await supabase.from(table).update({ done }).eq("id", todoId);
  if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

export async function smazatTodo(cil: "task" | "project", todoId: string): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  const table = cil === "task" ? "task_todos" : "project_todos";
  const { error } = await supabase.from(table).delete().eq("id", todoId);
  if (error) return { ok: false, chyba: "Smazání se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

// ---- Absence ------------------------------------------------------------------

export async function pridatAbsenci(
  profileId: string,
  type: AbsenceType,
  start: string,
  end: string,
  vynutit = false,
): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  if (!start || !end || start > end) return { ok: false, chyba: "Zadejte platné období." };
  const supabase = await createClient();

  // úkol × absence se hlásí i při zadávání absence (kap. 9)
  if (!vynutit) {
    const kolize = await najdiKolizeClena(supabase, profileId, start, end);
    const jenUkoly = kolize.filter((k) => k.s.startsWith("úkol"));
    if (jenUkoly.length > 0) return { ok: false, kolize: jenUkoly };
  }

  const { error } = await supabase
    .from("absences")
    .insert({ profile_id: profileId, type, start_date: start, end_date: end });
  if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

export async function smazatAbsenci(id: string): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  const { error } = await supabase.from("absences").delete().eq("id", id);
  if (error) return { ok: false, chyba: "Smazání se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

// ---- Archiv --------------------------------------------------------------------

export async function obnovitUkol(id: string): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  // Obnovený splněný úkol se vrátí jako splněný (přeškrtnutý) – jen status.
  const { error } = await supabase
    .from("tasks")
    .update({ status: "active", archived_by: null, archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, chyba: "Obnovení se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

/** Obnoví celý projekt i s jeho úkoly (sloučený záznam). */
export async function obnovitProjekt(id: string): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ status: "active", archived_by: null, archived_at: null })
    .eq("project_id", id)
    .eq("status", "archived");
  const { error } = await supabase
    .from("projects")
    .update({ status: "active", archived_by: null, archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, chyba: "Obnovení se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}

/** Nenávratně smaže všechny archivní záznamy (po potvrzení v UI). */
export async function smazatArchiv(): Promise<KVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  // Archivované úkoly (i ty pod archivovanými projekty).
  const { error: e1 } = await supabase.from("tasks").delete().eq("status", "archived");
  if (e1) return { ok: false, chyba: "Smazání archivu úkolů se nezdařilo." };
  const { error: e2 } = await supabase.from("projects").delete().eq("status", "archived");
  if (e2) return { ok: false, chyba: "Smazání archivu projektů se nezdařilo." };
  refreshKonstrukce();
  return { ok: true };
}
