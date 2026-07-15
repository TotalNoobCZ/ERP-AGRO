import { dayBefore, addDays, formatCz } from "./dates";

export type Interval = { datumOd: Date; datumDo: Date };

/** Dva intervaly se překrývají, pokud začátek jednoho není za koncem druhého. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.datumOd <= b.datumDo && b.datumOd <= a.datumDo;
}

export type ExistujiciPrirazeni = Interval & {
  id: string;
  zakazkaId: string;
  zakazkaKod: string;
};

/**
 * Najde všechna přiřazení dané osoby, která se překrývají s novým rozsahem.
 * `existujici` = seznam ostatních (nesmazaných) přiřazení téže osoby.
 * `excludeId` = přeskočit vlastní záznam při editaci.
 */
export function najdiKolize(
  novy: Interval,
  existujici: ExistujiciPrirazeni[],
  excludeId?: string
): ExistujiciPrirazeni[] {
  return existujici.filter((p) => p.id !== excludeId && overlaps(novy, p));
}

const max = (a: Date, b: Date) => (a > b ? a : b);
const min = (a: Date, b: Date) => (a < b ? a : b);

export type NavrhReseni = {
  kolize: ExistujiciPrirazeni;
  // Části původního nasazení, které osobě na původní akci zůstanou (mohou být obě, jedna, nebo žádná).
  castPred: Interval | null;
  castPo: Interval | null;
  // Překryv – na tuto část původní akce se dosadí náhradník.
  obdobiProNahradnika: Interval;
};

/**
 * Navrhne řešení kolize obecným rozdělením původního nasazení kolem nového období:
 * osoba je na novém období vytažena na jinou akci, na původní akci jí zůstanou části
 * před a po (pokud existují) a na překryv se dosadí náhradník.
 *
 * Příklad: akce A 10.–25. 7., osoba potřebná na akci B 13.–14. 7.
 *  -> na A zůstane 10.–12. 7. a 15.–25. 7., náhradník pokryje 13.–14. 7.
 */
export function navrhniReseni(novy: Interval, kolize: ExistujiciPrirazeni): NavrhReseni {
  const prekrytiOd = max(novy.datumOd, kolize.datumOd);
  const prekrytiDo = min(novy.datumDo, kolize.datumDo);

  const castPred: Interval | null =
    kolize.datumOd < prekrytiOd
      ? { datumOd: kolize.datumOd, datumDo: dayBefore(prekrytiOd) }
      : null;
  const castPo: Interval | null =
    kolize.datumDo > prekrytiDo
      ? { datumOd: addDays(prekrytiDo, 1), datumDo: kolize.datumDo }
      : null;

  return {
    kolize,
    castPred,
    castPo,
    obdobiProNahradnika: { datumOd: prekrytiOd, datumDo: prekrytiDo },
  };
}

/** Lidsky čitelný popis kolize pro dialog. */
export function popisKolize(osobaJmeno: string, k: ExistujiciPrirazeni): string {
  return `${osobaJmeno} je v období ${formatCz(k.datumOd)} – ${formatCz(
    k.datumDo
  )} již přiřazen(a) k akci ${k.zakazkaKod}.`;
}
