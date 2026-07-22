// Dotazová logika modulu Dílna – zakázky (vč. podzakázek) s výrobními fázemi
// a uskladněním. Sdílí zakázky se Zakázkami (informace se propisují).
import type { createClient } from "@/lib/supabase/server";
import { DILNA_FAZE, type DilnaFaze } from "@erp/core";

export type FazeData = {
  typ: DilnaFaze;
  datumOd: string | null;
  datumDo: string | null;
  poznamka: string | null;
};

export type DilnaZakazka = {
  id: string;
  kod: string;
  mistoPlneni: string;
  popis: string | null;
  parentId: string | null;
  zacatek: string;
  konecAktualni: string;
  stav: string;
  ulozeni: string | null;
  /** fáze podle typu (chybějící = neplánováno) */
  faze: Partial<Record<DilnaFaze, FazeData>>;
};

/** Aktivní zakázky (vč. podzakázek) s výrobními fázemi pro modul Dílna. */
export async function queryDilnaZakazky(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<DilnaZakazka[]> {
  const { data } = await supabase
    .from("zakazky")
    .select(
      "id, kod, misto_plneni, popis, parent_id, zacatek, konec_aktualni, stav, ulozeni, " +
        "dilna_faze:dilna_faze(typ, datum_od, datum_do, poznamka)",
    )
    .is("deleted_at", null)
    .in("stav", ["AKTIVNI", "POZASTAVENO"])
    .order("kod", { ascending: true });

  type Raw = {
    id: string;
    kod: string;
    misto_plneni: string;
    popis: string | null;
    parent_id: string | null;
    zacatek: string;
    konec_aktualni: string;
    stav: string;
    ulozeni: string | null;
    dilna_faze: Array<{ typ: string; datum_od: string | null; datum_do: string | null; poznamka: string | null }> | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((z) => {
    const faze: Partial<Record<DilnaFaze, FazeData>> = {};
    for (const f of z.dilna_faze ?? []) {
      if ((DILNA_FAZE as readonly string[]).includes(f.typ)) {
        faze[f.typ as DilnaFaze] = {
          typ: f.typ as DilnaFaze,
          datumOd: f.datum_od,
          datumDo: f.datum_do,
          poznamka: f.poznamka,
        };
      }
    }
    return {
      id: z.id,
      kod: z.kod,
      mistoPlneni: z.misto_plneni,
      popis: z.popis,
      parentId: z.parent_id,
      zacatek: z.zacatek,
      konecAktualni: z.konec_aktualni,
      stav: z.stav,
      ulozeni: z.ulozeni,
      faze,
    };
  });
}

/** Seskupí ploché zakázky do stromu akce → podzakázky. */
export function seskupitDoAkci(zakazky: DilnaZakazka[]): { akce: DilnaZakazka; deti: DilnaZakazka[] }[] {
  const ids = new Set(zakazky.map((z) => z.id));
  const detiMap = new Map<string, DilnaZakazka[]>();
  for (const z of zakazky) {
    if (z.parentId && ids.has(z.parentId)) {
      if (!detiMap.has(z.parentId)) detiMap.set(z.parentId, []);
      detiMap.get(z.parentId)!.push(z);
    }
  }
  return zakazky
    .filter((z) => !z.parentId || !ids.has(z.parentId))
    .map((akce) => ({ akce, deti: detiMap.get(akce.id) ?? [] }));
}
