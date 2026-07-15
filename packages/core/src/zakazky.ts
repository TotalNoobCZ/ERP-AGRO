// ----------------------------------------------------------------------------
//  Modul Zakázky (páteř) – stavy, milníky a labely.
//  Převzato 1:1 z Planovani/src/lib/orders.ts a tiskových stránek.
// ----------------------------------------------------------------------------

export const ZAKAZKA_STAVY = ["AKTIVNI", "POZASTAVENO", "DOKONCENO", "ARCHIV"] as const;
export type StavZakazky = (typeof ZAKAZKA_STAVY)[number];

export const ZAKAZKA_STAV_LABELS: Record<StavZakazky, string> = {
  AKTIVNI: "Aktivní",
  POZASTAVENO: "Pozastaveno",
  DOKONCENO: "Dokončeno",
  ARCHIV: "Archiv",
};

/** Zakázky, které se zobrazují v plánu (běžící). */
export const ZAKAZKA_BEZICI_STAVY: StavZakazky[] = ["AKTIVNI", "POZASTAVENO"];

export const MILNIK_TYPY = [
  "ZAHAJENI_VYROBY",
  "PREDANI_LAKOVANI",
  "UKONCENI_VYROBY",
  "UKONCENI_LAKOVANI",
] as const;
export type TypMilniku = (typeof MILNIK_TYPY)[number];

export const MILNIK_LABELS: Record<TypMilniku, string> = {
  ZAHAJENI_VYROBY: "Zahájení výroby",
  PREDANI_LAKOVANI: "Předání do lakování",
  UKONCENI_VYROBY: "Ukončení výroby",
  UKONCENI_LAKOVANI: "Ukončení lakování",
};

export const TYP_ZMENY = ["VYTVORENI", "UPRAVA", "SMAZANI", "PRODLOUZENI", "ARCHIVACE"] as const;
export type TypZmeny = (typeof TYP_ZMENY)[number];

/** Priorita zakázky 1–5 (1 = nejvyšší). */
export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 5;
