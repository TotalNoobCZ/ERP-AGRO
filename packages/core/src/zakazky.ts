// ----------------------------------------------------------------------------
//  Modul Zakázky (páteř) – stavy, milníky a labely.
//  Převzato 1:1 z Planovani/src/lib/orders.ts a tiskových stránek.
// ----------------------------------------------------------------------------

// Životní cyklus akce: běží → po výrobě „Fakturace" (řeší se vystavení faktury)
// → „Proplaceno" = finále (bere se jako hotové) → případně Archiv.
export const ZAKAZKA_STAVY = ["AKTIVNI", "POZASTAVENO", "FAKTURACE", "PROPLACENO", "ARCHIV"] as const;
export type StavZakazky = (typeof ZAKAZKA_STAVY)[number];

export const ZAKAZKA_STAV_LABELS: Record<StavZakazky, string> = {
  AKTIVNI: "Aktivní",
  POZASTAVENO: "Pozastaveno",
  FAKTURACE: "Fakturace",
  PROPLACENO: "Proplaceno",
  ARCHIV: "Archiv",
};

/** Zakázky, které se zobrazují v plánu (běžící). */
export const ZAKAZKA_BEZICI_STAVY: StavZakazky[] = ["AKTIVNI", "POZASTAVENO"];

/** Stavy finále akce – vlastní lišta „Fakturace" (přehled fakturace a plateb). */
export const ZAKAZKA_FAKTURACNI_STAVY: StavZakazky[] = ["FAKTURACE", "PROPLACENO"];

export const MILNIK_TYPY = [
  "ZAHAJENI_VYROBY",
  "PREDANI_LAKOVANI",
  "UKONCENI_VYROBY",
  "UKONCENI_LAKOVANI",
  "MONTAZ_ZACATEK",
  "MONTAZ_KONEC",
  "DEMONTAZ_ZACATEK",
  "DEMONTAZ_KONEC",
  "EXPEDICE",
  "VLASTNI",
] as const;
export type TypMilniku = (typeof MILNIK_TYPY)[number];

/** Předvolené typy do výběru (bez „VLASTNI" – to je jen volný název). */
export const MILNIK_TYPY_PREDVOLBA = MILNIK_TYPY.filter((t) => t !== "VLASTNI");

export const MILNIK_LABELS: Record<TypMilniku, string> = {
  ZAHAJENI_VYROBY: "Zahájení výroby",
  PREDANI_LAKOVANI: "Předání do lakování",
  UKONCENI_VYROBY: "Ukončení výroby",
  UKONCENI_LAKOVANI: "Ukončení lakování",
  MONTAZ_ZACATEK: "Montáž – začátek",
  MONTAZ_KONEC: "Montáž – konec",
  DEMONTAZ_ZACATEK: "Demontáž – začátek",
  DEMONTAZ_KONEC: "Demontáž – konec",
  EXPEDICE: "Expedice",
  VLASTNI: "Vlastní",
};

export const TYP_ZMENY = ["VYTVORENI", "UPRAVA", "SMAZANI", "PRODLOUZENI", "ARCHIVACE"] as const;
export type TypZmeny = (typeof TYP_ZMENY)[number];

/** Záznam Montáž / Demontáž u akce. */
export const MONTAZ_TYPY = ["MONTAZ", "DEMONTAZ"] as const;
export type MontazTyp = (typeof MONTAZ_TYPY)[number];
export const MONTAZ_LABELS: Record<MontazTyp, string> = {
  MONTAZ: "Montáž",
  DEMONTAZ: "Demontáž",
};

/** Priorita zakázky 1–5 (1 = nejvyšší). */
export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 5;

/**
 * Kód zakázky pro zobrazení: šestimístné číslo se dělí mezerou po trojici
 * („826193" → „826 193"). Jiné tvary se vrací beze změny. Jen zobrazení –
 * ukládá se dál bez mezery.
 */
export function formatKod(kod: string): string {
  return /^\d{6}$/.test(kod) ? `${kod.slice(0, 3)} ${kod.slice(3)}` : kod;
}
