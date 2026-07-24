// ----------------------------------------------------------------------------
//  Upozornění k zakázkám pro odpovědnou osobu (zobrazí se na úvodu „Moje práce").
//   1) Neproplacená fakturace – akce je ve stavu „Fakturace" déle než 30 dní
//      a nebyla označena jako proplacená.
//   2) Chybějící fakturace – hlavní akce je více než 7 dní po termínu ukončení
//      a stále nebyla posunuta do fakturace.
//  Odpovědnou osobu má vždy hlavní akce; podzakázka ji dědí od rodiče.
// ----------------------------------------------------------------------------
import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { today, addDays, formatDay } from "@/lib/zakazky/dates";

/** Lhůta proplacení faktury (dny) a lhůta pro posun do fakturace po termínu (dny). */
export const DNI_DO_PROPLACENI = 30;
export const DNI_DO_FAKTURACE = 7;

const DEN_MS = 86_400_000;

export type NeproplacenaZakazka = {
  id: string;
  kod: string;
  popis: string;
  dniVeFakturaci: number;
};

export type ChybejiciFakturace = {
  id: string;
  kod: string;
  popis: string;
  dniPoTerminu: number;
};

export type ZakazkyUpozorneni = {
  neproplacene: NeproplacenaZakazka[];
  chybejiciFakturace: ChybejiciFakturace[];
};

const PRAZDNO: ZakazkyUpozorneni = { neproplacene: [], chybejiciFakturace: [] };

/** Upozornění k zakázkám, za které přihlášený uživatel odpovídá. */
export async function queryZakazkyUpozorneni(
  supabase: Awaited<ReturnType<typeof createClient>>,
  personId: string,
): Promise<ZakazkyUpozorneni> {
  if (!personId) return PRAZDNO;

  const nyni = Date.now();
  const hraniceProplaceni = new Date(nyni - DNI_DO_PROPLACENI * DEN_MS).toISOString();
  const hraniceFakturace = formatDay(addDays(today(), -DNI_DO_FAKTURACE));

  const [fakturaceRes, poTerminuRes] = await Promise.all([
    // 1) Ve fakturaci déle než 30 dní, dosud neproplaceno.
    supabase
      .from("zakazky")
      .select("id, kod, popis, misto_plneni, fakturace_od, odpovedna_osoba_id, parent_id")
      .eq("stav", "FAKTURACE")
      .is("deleted_at", null)
      .not("fakturace_od", "is", null)
      .lte("fakturace_od", hraniceProplaceni),
    // 2) Hlavní akce více než 7 dní po termínu, dosud bez posunu do fakturace.
    supabase
      .from("zakazky")
      .select("id, kod, popis, misto_plneni, konec_aktualni")
      .is("parent_id", null)
      .is("deleted_at", null)
      .eq("odpovedna_osoba_id", personId)
      .in("stav", ["AKTIVNI", "POZASTAVENO"])
      .lt("konec_aktualni", hraniceFakturace),
  ]);

  // Odpovědná osoba se u podzakázky nezadává – dědí se od hlavní akce.
  // Doplníme odpovědnou osobu rodičů u těch fakturačních zakázek, které ji nemají.
  const fakturaceRows = fakturaceRes.data ?? [];
  const parentIds = [
    ...new Set(
      fakturaceRows.filter((z) => !z.odpovedna_osoba_id && z.parent_id).map((z) => z.parent_id as string),
    ),
  ];
  const odpovedniRodicu = new Map<string, string | null>();
  if (parentIds.length > 0) {
    const { data: rodice } = await supabase
      .from("zakazky")
      .select("id, odpovedna_osoba_id")
      .in("id", parentIds);
    for (const r of rodice ?? []) odpovedniRodicu.set(r.id, r.odpovedna_osoba_id);
  }

  const neproplacene: NeproplacenaZakazka[] = fakturaceRows
    .filter((z) => {
      const odpovedny = z.odpovedna_osoba_id ?? (z.parent_id ? odpovedniRodicu.get(z.parent_id) ?? null : null);
      return odpovedny === personId;
    })
    .map((z) => ({
      id: z.id,
      kod: z.kod,
      popis: z.popis || z.misto_plneni,
      dniVeFakturaci: Math.floor((nyni - new Date(z.fakturace_od as string).getTime()) / DEN_MS),
    }))
    .sort((a, b) => b.dniVeFakturaci - a.dniVeFakturaci);

  const dnesMs = today().getTime();
  const chybejiciFakturace: ChybejiciFakturace[] = (poTerminuRes.data ?? [])
    .map((z) => ({
      id: z.id,
      kod: z.kod,
      popis: z.popis || z.misto_plneni,
      dniPoTerminu: Math.floor((dnesMs - new Date(z.konec_aktualni + "T00:00:00Z").getTime()) / DEN_MS),
    }))
    .sort((a, b) => b.dniPoTerminu - a.dniPoTerminu);

  return { neproplacene, chybejiciFakturace };
}
