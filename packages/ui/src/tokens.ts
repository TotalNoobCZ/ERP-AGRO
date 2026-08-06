// ----------------------------------------------------------------------------
//  Barevné tokeny a paleta uživatelů (ZADANI.md kap. 5) – jediné místo pravdy.
//  Tmavé téma, pastely čitelné na černé, na dlaždicích tmavý text.
// ----------------------------------------------------------------------------

export const COLOR_TOKENS = {
  bg: "#0E0F11",        // pozadí (skoro černá)
  surface: "#16181B",   // panely, dialogy
  border: "#7C828B",    // hranice, dělící čáry
  text: "#E8E9EB",      // hlavní text
  textMuted: "#9AA0A8", // vedlejší text (jména zodpovědných, meta)
  neutral: "#8A8F98",   // neutrální dlaždice (nepřiřazený / hotový úkol)
} as const;

/** Paleta uživatelů – 10 pastelů (index = profiles.color_index). */
export const USER_PALETTE = [
  "#A8C7E7", // 0 modrá
  "#A8D8B9", // 1 zelená
  "#F0C9A0", // 2 broskvová
  "#E8B4C0", // 3 růžová
  "#C9B8E0", // 4 levandulová
  "#A0D2D2", // 5 tyrkysová
  "#E8DBA0", // 6 žlutá
  "#EAB0A0", // 7 korálová
  "#B8E0C8", // 8 mátová
  "#B0BEE8", // 9 modrofialová
] as const;

export const USER_PALETTE_NAMES = [
  "Modrá",
  "Zelená",
  "Broskvová",
  "Růžová",
  "Levandulová",
  "Tyrkysová",
  "Žlutá",
  "Korálová",
  "Mátová",
  "Modrofialová",
] as const;

/**
 * Výchozí barva podle oddělení (karta zaměstnance „Dle oddělení"): každé
 * oddělení má svou barvu z palety. Klíč = profiles.oddeleni.
 */
export const ODDELENI_BARVA: Record<string, string> = {
  // Dílna
  vyroba: USER_PALETTE[0],             // modrá
  montaz: USER_PALETTE[1],             // zelená
  elektro: USER_PALETTE[2],            // broskvová
  // Kancelář
  kancelar: USER_PALETTE[3],           // růžová
  obchod: USER_PALETTE[4],             // levandulová
  obchodni_manazer: USER_PALETTE[5],   // tyrkysová
  konstrukce: USER_PALETTE[6],         // žlutá
  projektak: USER_PALETTE[7],          // korálová
  elektro_projektant: USER_PALETTE[8], // mátová
  programator: USER_PALETTE[9],        // modrofialová
};

/**
 * Barva člena: vlastní hex (profiles.color_hex) má přednost, jinak paleta
 * podle color_index; mimo rozsah / null → neutrální.
 */
export function userColor(colorIndex: number | null | undefined, colorHex?: string | null): string {
  if (colorHex && /^#[0-9a-fA-F]{6}$/.test(colorHex)) return colorHex;
  if (colorIndex == null) return COLOR_TOKENS.neutral;
  return USER_PALETTE[colorIndex] ?? COLOR_TOKENS.neutral;
}
