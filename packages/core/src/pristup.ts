// ----------------------------------------------------------------------------
//  Přístupová práva k modulům („kartám"). Administrátor je nastavuje:
//   • plošně dle oddělení (department_access),
//   • jednotlivě u profilu (profiles.access_modules – přepíše oddělení).
//  Kromě toho platí, že uživatelé z kapitoly Dílna (výroba/montáž/elektro)
//  vidí v Zakázkách jen zakázky, ke kterým jsou přiřazeni.
// ----------------------------------------------------------------------------
import { jeDilna } from "./roles";

/** Moduly („karty"), na které lze nastavit přístup. Správa je vždy jen admin. */
export const MODULY = ["poptavky", "zakazky", "konstrukce"] as const;
export type Modul = (typeof MODULY)[number];

export const MODUL_LABELS: Record<Modul, string> = {
  poptavky: "Poptávky",
  zakazky: "Zakázky",
  konstrukce: "Konstrukce",
};

/** Výchozí přístup dle oddělení: oddeleni → seznam povolených modulů. */
export type DepartmentAccess = Record<string, Modul[]>;

function jenModuly(seznam: readonly string[] | null | undefined): Modul[] {
  if (!seznam) return [];
  return MODULY.filter((m) => seznam.includes(m));
}

/**
 * Vypočítá, které moduly uživatel vidí:
 *  1) admin → všechny,
 *  2) vlastní nastavení profilu (accessModules ≠ null) → má přednost,
 *  3) jinak výchozí dle oddělení (pokud je nakonfigurováno),
 *  4) jinak všechny (zpětná kompatibilita – dokud admin nic nenastaví).
 */
export function povoleneModuly(
  p: { role: string; oddeleni: string | null | undefined; accessModules: string[] | null | undefined },
  vychoziDleOddeleni: DepartmentAccess,
): Modul[] {
  if (p.role === "admin") return [...MODULY];
  if (p.accessModules != null) return jenModuly(p.accessModules);
  const dep = p.oddeleni ? vychoziDleOddeleni[p.oddeleni] : undefined;
  if (dep != null) return jenModuly(dep);
  return [...MODULY];
}

/** Má uživatel přístup ke konkrétnímu modulu? */
export function maPristupKModulu(modul: Modul, povolene: Modul[]): boolean {
  return povolene.includes(modul);
}

/**
 * Vidí uživatel v Zakázkách jen zakázky, ke kterým je přiřazen?
 * Platí pro kapitolu Dílna (výroba/montáž/elektro).
 */
export function jenPrirazeneZakazky(oddeleni: string | null | undefined): boolean {
  return jeDilna(oddeleni);
}
