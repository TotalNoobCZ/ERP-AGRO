// Sdílená dotazová logika modulu Zakázky – seznam, filtry, dashboard i tisk.
import type { createClient } from "@/lib/supabase/server";
import { parseDay } from "@/lib/zakazky/dates";
import { poTerminu } from "@/lib/zakazky/orders";
import { ZAKAZKA_STAVY, type StavZakazky } from "@erp/core";

export type ZakazkaListParams = { q?: string; stav?: string; stavy?: string; priorita?: string };

/**
 * Množina ID zakázek, ke kterým je osoba přiřazena (jako pracovník) nebo je
 * jejich odpovědnou osobou. Slouží k omezení pohledu pro Dílnu.
 */
export async function zakazkyOsobyIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  osobaId: string,
): Promise<Set<string>> {
  const [pr, odp] = await Promise.all([
    supabase.from("prirazeni_zakazka").select("zakazka_id").eq("osoba_id", osobaId).is("deleted_at", null),
    supabase.from("zakazky").select("id").eq("odpovedna_osoba_id", osobaId).is("deleted_at", null),
  ]);
  const set = new Set<string>();
  for (const r of (pr.data ?? []) as { zakazka_id: string }[]) set.add(r.zakazka_id);
  for (const r of (odp.data ?? []) as { id: string }[]) set.add(r.id);
  return set;
}

export type ZakazkaListRow = {
  id: string;
  kod: string;
  misto_plneni: string;
  popis: string | null;
  parent_id: string | null;
  priorita: number;
  zacatek: string;
  konec_aktualni: string;
  stav: StavZakazky;
  inquiry_id: string | null;
  odpovedna: { name: string } | null;
  prirazeni: { count: number }[];
};

export async function queryZakazky(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: ZakazkaListParams,
  /** Dílna: omez na zakázky, ke kterým je osoba přiřazena (+ jejich akce). */
  omezeniOsobaId?: string | null,
): Promise<ZakazkaListRow[]> {
  const q = params.q?.trim();
  const stav = params.stav;
  // Multi-výběr stavů: „chci jen tyto stavy" (a tím i „všechny kromě některých").
  const stavy = (params.stavy ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => (ZAKAZKA_STAVY as readonly string[]).includes(s)) as StavZakazky[];
  const priorita = params.priorita ? Number(params.priorita) : undefined;

  let query = supabase
    .from("zakazky")
    .select(
      "id, kod, misto_plneni, popis, parent_id, priorita, zacatek, konec_aktualni, stav, inquiry_id, odpovedna:profiles!zakazky_odpovedna_osoba_id_fkey(name), prirazeni:prirazeni_zakazka(count)",
    )
    .is("deleted_at", null)
    .order("priorita", { ascending: true })
    .order("konec_aktualni", { ascending: true });

  if (q) query = query.or(`kod.ilike.%${q}%,misto_plneni.ilike.%${q}%`);
  if (stav === "PO_TERMINU") {
    // řeší se post-query filtrem níže
  } else if (stavy.length) {
    // Vybrané stavy (jen tyto). „Všechny kromě X" = vyber všechny kromě X.
    query = query.in("stav", stavy);
  } else if (stav && (ZAKAZKA_STAVY as readonly string[]).includes(stav)) {
    query = query.eq("stav", stav as StavZakazky);
  } else {
    query = query.neq("stav", "ARCHIV");
  }
  if (priorita) query = query.eq("priorita", priorita);

  const { data } = await query;
  let rows = (data ?? []) as unknown as ZakazkaListRow[];
  if (stav === "PO_TERMINU") {
    rows = rows.filter((z) => poTerminu({ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }));
  }
  if (omezeniOsobaId) {
    const moje = await zakazkyOsobyIds(supabase, omezeniOsobaId);
    // Povolené = přiřazené zakázky + jejich nadřazené akce (kvůli seskupení).
    const povolene = new Set(moje);
    for (const r of rows) if (moje.has(r.id) && r.parent_id) povolene.add(r.parent_id);
    rows = rows.filter((z) => povolene.has(z.id));
  }
  return rows;
}

// ---------- Tabule zakázek (obrácené drag & drop: osoba → zakázka) ----------

export type BoardOsobaZ = { id: string; name: string; oddeleni: string | null; role: string | null; colorIndex: number | null };
// Jeden pracovník = jedna položka na kartě, i když má víc přiřazení (např. po
// dočasné výměně a návratu). prirazeniIds drží všechna jeho živá přiřazení,
// aby křížek odebral pracovníka z akce úplně.
export type BoardPrirazeni = { prirazeniIds: string[]; osobaId: string; name: string; oddeleni: string | null; colorIndex: number | null };
export type BoardOdpovedna = { id: string; name: string; colorIndex: number | null };
export type BoardZakazka = {
  id: string;
  kod: string;
  mistoPlneni: string;
  popis: string | null;
  parentId: string | null;
  zacatek: string;
  konecAktualni: string;
  odpovednaOsobaId: string | null;
  odpovednaOsoba: BoardOdpovedna | null;
  pracovnici: BoardPrirazeni[];
};

/** Data pro tabuli zakázek: přiřaditelné osoby + otevřené zakázky s pracovníky. */
export async function queryZakazkyBoard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  /** Dílna: omez na zakázky, ke kterým je osoba přiřazena (+ jejich akce). */
  omezeniOsobaId?: string | null,
): Promise<{ osoby: BoardOsobaZ[]; zakazky: BoardZakazka[] }> {
  const [osobyRes, zakRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, oddeleni, role, color_index")
      .eq("active", true)
      .eq("assignable", true)
      .order("name", { ascending: true }),
    supabase
      .from("zakazky")
      .select(
        "id, kod, misto_plneni, popis, parent_id, zacatek, konec_aktualni, odpovedna_osoba_id, " +
          "odpovedna:profiles!zakazky_odpovedna_osoba_id_fkey(id, name, color_index), " +
          "prirazeni:prirazeni_zakazka(id, osoba_id, deleted_at, osoba:profiles(id, name, oddeleni, color_index))",
      )
      .is("deleted_at", null)
      .in("stav", ["AKTIVNI", "POZASTAVENO"])
      .order("konec_aktualni", { ascending: true }),
  ]);

  const osoby: BoardOsobaZ[] = (osobyRes.data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    oddeleni: o.oddeleni,
    role: o.role,
    colorIndex: o.color_index,
  }));

  type RawZ = {
    id: string;
    kod: string;
    misto_plneni: string;
    popis: string | null;
    parent_id: string | null;
    zacatek: string;
    konec_aktualni: string;
    odpovedna_osoba_id: string | null;
    odpovedna: { id: string; name: string; color_index: number | null } | null;
    prirazeni: Array<{
      id: string;
      osoba_id: string;
      deleted_at: string | null;
      osoba: { id: string; name: string; oddeleni: string | null; color_index: number | null } | null;
    }> | null;
  };
  const rawZ = (zakRes.data ?? []) as unknown as RawZ[];

  const zakazky: BoardZakazka[] = rawZ.map((z) => {
    const prir = z.prirazeni ?? [];
    // Sloučení podle osoby: stejný pracovník s víc přiřazeními (dočasná výměna
    // a návrat) se ukáže jen jednou; sbíráme všechna jeho přiřazení.
    const pracovniciMap = new Map<string, BoardPrirazeni>();
    for (const p of prir.filter((x) => !x.deleted_at)) {
      const existuje = pracovniciMap.get(p.osoba_id);
      if (existuje) {
        existuje.prirazeniIds.push(p.id);
      } else {
        pracovniciMap.set(p.osoba_id, {
          prirazeniIds: [p.id],
          osobaId: p.osoba_id,
          name: p.osoba?.name ?? "?",
          oddeleni: p.osoba?.oddeleni ?? null,
          colorIndex: p.osoba?.color_index ?? null,
        });
      }
    }
    const pracovnici: BoardPrirazeni[] = [...pracovniciMap.values()];
    return {
      id: z.id,
      kod: z.kod,
      mistoPlneni: z.misto_plneni,
      popis: z.popis,
      parentId: z.parent_id,
      zacatek: z.zacatek,
      konecAktualni: z.konec_aktualni,
      odpovednaOsobaId: z.odpovedna_osoba_id,
      odpovednaOsoba: z.odpovedna
        ? { id: z.odpovedna.id, name: z.odpovedna.name, colorIndex: z.odpovedna.color_index }
        : null,
      pracovnici,
    };
  });

  if (omezeniOsobaId) {
    // Přiřazené (pracovník nebo odpovědná osoba) + jejich nadřazené akce.
    const moje = new Set(
      zakazky
        .filter(
          (z) =>
            z.odpovednaOsobaId === omezeniOsobaId ||
            z.pracovnici.some((p) => p.osobaId === omezeniOsobaId),
        )
        .map((z) => z.id),
    );
    const povolene = new Set(moje);
    for (const z of zakazky) if (moje.has(z.id) && z.parentId) povolene.add(z.parentId);
    return { osoby, zakazky: zakazky.filter((z) => povolene.has(z.id)) };
  }

  return { osoby, zakazky };
}
