// Datový loader modulu Konstrukce – sdílený pro Plánování, Gantt i dialog člena.
import type { createClient } from "@/lib/supabase/server";
import type { Absence, Clen, Projekt, Ukol } from "@/components/konstrukce/types";

type Db = Awaited<ReturnType<typeof createClient>>;

export async function nactiKonstrukci(supabase: Db): Promise<{
  clenove: Clen[];
  projektaci: Clen[];
  projekty: Projekt[];
  ukoly: Ukol[];
  absence: Absence[];
}> {
  const [clenoveRes, projektaciRes, projektyRes, ukolyRes, absenceRes] = await Promise.all([
    // Dlaždice: přiřaditelní členové konstrukčního týmu (oddělení Konstrukce).
    supabase
      .from("profiles")
      .select("id, name, color_index, tile_order")
      .eq("active", true)
      .eq("assignable", true)
      .eq("oddeleni", "konstrukce")
      .order("tile_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    // Možní vedoucí projektu: oddělení Projekťák NEBO role Vedoucí.
    supabase
      .from("profiles")
      .select("id, name, color_index, tile_order")
      .eq("active", true)
      .or("oddeleni.eq.projektak,role.eq.vedouci")
      .order("name", { ascending: true }),
    supabase
      .from("projects")
      .select(
        `id, name, zakazka_id, owner_id, status,
         zakazka:zakazky(kod),
         owner:profiles!projects_owner_id_fkey(name),
         project_notes(id, body, created_at, author:profiles(name)),
         project_todos(id, body, done, position)`,
      )
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        `id, project_id, name, assignee_id, start_date, end_date, duration_days,
         completed, order_in_member, status,
         project:projects!inner(name, status),
         task_notes(id, body, created_at, author:profiles(name)),
         task_todos(id, body, done, position)`,
      )
      .eq("status", "active")
      .eq("project.status", "active"),
    supabase.from("absences").select("id, profile_id, type, start_date, end_date"),
  ]);

  const mapClen = (c: { id: string; name: string; color_index: number | null; tile_order: number | null }): Clen => ({
    id: c.id,
    name: c.name,
    colorIndex: c.color_index,
    tileOrder: c.tile_order,
  });
  const clenove: Clen[] = (clenoveRes.data ?? []).map(mapClen);
  const projektaci: Clen[] = (projektaciRes.data ?? []).map(mapClen);

  type NoteRow = { id: string; body: string; created_at: string; author: { name: string } | null };
  type TodoRow = { id: string; body: string; done: boolean; position: number | null };
  const mapNotes = (rows: NoteRow[] | null | undefined) =>
    (rows ?? [])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at, author: n.author?.name ?? null }));
  const mapTodos = (rows: TodoRow[] | null | undefined) =>
    (rows ?? []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const projekty: Projekt[] = ((projektyRes.data ?? []) as unknown as {
    id: string;
    name: string;
    zakazka_id: string;
    owner_id: string | null;
    zakazka: { kod: string } | null;
    owner: { name: string } | null;
    project_notes: NoteRow[];
    project_todos: TodoRow[];
  }[]).map((p) => ({
    id: p.id,
    name: p.name,
    zakazkaId: p.zakazka_id,
    zakazkaKod: p.zakazka?.kod ?? "?",
    ownerId: p.owner_id,
    ownerName: p.owner?.name ?? null,
    notes: mapNotes(p.project_notes),
    todos: mapTodos(p.project_todos),
  }));

  const ukoly: Ukol[] = ((ukolyRes.data ?? []) as unknown as {
    id: string;
    project_id: string;
    name: string;
    assignee_id: string | null;
    start_date: string | null;
    end_date: string | null;
    duration_days: number | null;
    completed: boolean;
    order_in_member: number | null;
    project: { name: string } | null;
    task_notes: NoteRow[];
    task_todos: TodoRow[];
  }[]).map((t) => ({
    id: t.id,
    projectId: t.project_id,
    projectName: t.project?.name ?? "?",
    name: t.name,
    assigneeId: t.assignee_id,
    startDate: t.start_date,
    endDate: t.end_date,
    durationDays: t.duration_days,
    completed: t.completed,
    orderInMember: t.order_in_member,
    notes: mapNotes(t.task_notes),
    todos: mapTodos(t.task_todos),
  }));

  const absence: Absence[] = (absenceRes.data ?? []).map((a) => ({
    id: a.id,
    profileId: a.profile_id,
    type: a.type,
    startDate: a.start_date,
    endDate: a.end_date,
  }));

  return { clenove, projektaci, projekty, ukoly, absence };
}
