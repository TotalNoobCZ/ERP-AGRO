// ----------------------------------------------------------------------------
//  Modul Poptávky – stavy a labely.
//  Převzato 1:1 z Popt-vky/lib/labels.ts (jen bez závislosti na Prisma).
// ----------------------------------------------------------------------------

export const INQUIRY_STATUSES = [
  "NOVA",
  "V_JEDNANI",
  "ODESLANA",
  "NEREAGUJE",
  "ODLOZENO",
  "OBJEDNANO",
  "ZAMITNUTO",
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NOVA: "Nová",
  V_JEDNANI: "V jednání",
  ODESLANA: "Odeslána",
  NEREAGUJE: "Nereaguje",
  ODLOZENO: "Odloženo",
  OBJEDNANO: "Objednáno",
  ZAMITNUTO: "Zamítnuto",
};

/** Pořadí stavů pro výběr v rozbalovacím menu a na dashboardu. */
export const INQUIRY_STATUS_ORDER: InquiryStatus[] = [...INQUIRY_STATUSES];

/**
 * Ukončené / skryté stavy – nezobrazují se v hlavním seznamu ani na tabuli,
 * nefigurují v „po termínu". „Odloženo" je skryté, dokud nepřijde připomenutí.
 */
export const INQUIRY_CLOSED_STATUSES: InquiryStatus[] = ["ODLOZENO", "OBJEDNANO", "ZAMITNUTO"];

/**
 * Přechod stavu, který spouští tok mezi moduly:
 * poptávka → OBJEDNANO ⇒ nabídnout založení zakázky (zakazky.inquiry_id).
 */
export function shouldOfferZakazka(from: InquiryStatus | null, to: InquiryStatus): boolean {
  return to === "OBJEDNANO" && from !== "OBJEDNANO";
}
