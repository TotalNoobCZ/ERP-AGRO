// ----------------------------------------------------------------------------
//  Modul Dílna – výrobní fáze (mistr / koordinátor výroby). Fáze mají termín
//  od–do a propisují se napříč programem (zakázky, gantt).
// ----------------------------------------------------------------------------

/** Výrobní fáze v dílně (v pořadí toku výroby). */
export const DILNA_FAZE = ["PALENI_PRIPRAVA", "SVAROVANI", "LAKOVNA", "MONTAZ"] as const;
export type DilnaFaze = (typeof DILNA_FAZE)[number];

export const DILNA_FAZE_LABELS: Record<DilnaFaze, string> = {
  PALENI_PRIPRAVA: "Pálení a příprava",
  SVAROVANI: "Svařování",
  LAKOVNA: "Lakovna",
  MONTAZ: "Montáž",
};

/** Barvy pruhů fází v ganttu (sladěné s tématem, čitelné na bílém textu). */
export const DILNA_FAZE_BARVY: Record<DilnaFaze, string> = {
  PALENI_PRIPRAVA: "#b45309", // amber-700
  SVAROVANI: "#1d4ed8", // blue-700
  LAKOVNA: "#7c3aed", // violet-600
  MONTAZ: "#15803d", // green-700
};

export function jeDilnaFaze(x: string): x is DilnaFaze {
  return (DILNA_FAZE as readonly string[]).includes(x);
}
