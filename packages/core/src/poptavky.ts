// ----------------------------------------------------------------------------
//  Modul Poptávky – stavy a labely.
//  Převzato 1:1 z Popt-vky/lib/labels.ts (jen bez závislosti na Prisma).
// ----------------------------------------------------------------------------

export const INQUIRY_STATUSES = [
  "NOVA",
  "V_JEDNANI",
  "ODESLANA",
  "NEREAGUJE",
  "OBJEDNANO",
  "ZAMITNUTO",
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NOVA: "Nová",
  V_JEDNANI: "V jednání",
  ODESLANA: "Odeslána",
  NEREAGUJE: "Nereaguje",
  OBJEDNANO: "Objednáno",
  ZAMITNUTO: "Zamítnuto",
};

/** Pořadí stavů pro výběr v rozbalovacím menu a na dashboardu. */
export const INQUIRY_STATUS_ORDER: InquiryStatus[] = [...INQUIRY_STATUSES];

/** Ukončené stavy – bez notifikací, nefigurují v „po termínu". */
export const INQUIRY_CLOSED_STATUSES: InquiryStatus[] = ["OBJEDNANO", "ZAMITNUTO"];

/**
 * Přechod stavu, který spouští tok mezi moduly:
 * poptávka → OBJEDNANO ⇒ nabídnout založení zakázky (zakazky.inquiry_id).
 */
export function shouldOfferZakazka(from: InquiryStatus | null, to: InquiryStatus): boolean {
  return to === "OBJEDNANO" && from !== "OBJEDNANO";
}
