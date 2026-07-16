// Sdílená dotazová logika modulu Zakázky – seznam, filtry, dashboard i tisk.
import type { createClient } from "@/lib/supabase/server";
import { parseDay } from "@/lib/zakazky/dates";
import { poTerminu } from "@/lib/zakazky/orders";
import { ZAKAZKA_STAVY, type StavZakazky } from "@erp/core";

export type ZakazkaListParams = { q?: string; stav?: string; priorita?: string };

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
): Promise<ZakazkaListRow[]> {
  const q = params.q?.trim();
  const stav = params.stav;
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
  if (stav && stav !== "PO_TERMINU" && (ZAKAZKA_STAVY as readonly string[]).includes(stav)) {
    query = query.eq("stav", stav as StavZakazky);
  } else if (stav !== "PO_TERMINU") {
    query = query.neq("stav", "ARCHIV");
  }
  if (priorita) query = query.eq("priorita", priorita);

  const { data } = await query;
  let rows = (data ?? []) as unknown as ZakazkaListRow[];
  if (stav === "PO_TERMINU") {
    rows = rows.filter((z) => poTerminu({ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }));
  }
  return rows;
}

// ---------- Tabule zakázek (obrácené drag & drop: osoba → zakázka) ----------

export type BoardOsobaZ = { id: string; name: string; oddeleni: string | null; colorIndex: number | null };
export type BoardPrirazeni = { prirazeniId: string; osobaId: string; name: string; oddeleni: string | null; colorIndex: number | null };
export type BoardZakazka = {
  id: string;
  kod: string;
  mistoPlneni: string;
  popis: string | null;
  parentId: string | null;
  zacatek: string;
  konecAktualni: string;
  odpovednaOsobaId: string | null;
  pracovnici: BoardPrirazeni[];
};

/** Data pro tabuli zakázek: přiřaditelné osoby + otevřené zakázky s pracovníky. */
export async function queryZakazkyBoard(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ osoby: BoardOsobaZ[]; zakazky: BoardZakazka[] }> {
  const [osobyRes, zakRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, oddeleni, color_index")
      .eq("active", true)
      .eq("assignable", true)
      .order("name", { ascending: true }),
    supabase
      .from("zakazky")
      .select(
        "id, kod, misto_plneni, popis, parent_id, zacatek, konec_aktualni, odpovedna_osoba_id, " +
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
    const pracovnici: BoardPrirazeni[] = prir
      .filter((p) => !p.deleted_at)
      .map((p) => ({
        prirazeniId: p.id,
        osobaId: p.osoba_id,
        name: p.osoba?.name ?? "?",
        oddeleni: p.osoba?.oddeleni ?? null,
        colorIndex: p.osoba?.color_index ?? null,
      }));
    return {
      id: z.id,
      kod: z.kod,
      mistoPlneni: z.misto_plneni,
      popis: z.popis,
      parentId: z.parent_id,
      zacatek: z.zacatek,
      konecAktualni: z.konec_aktualni,
      odpovednaOsobaId: z.odpovedna_osoba_id,
      pracovnici,
    };
  });

  return { osoby, zakazky };
}
