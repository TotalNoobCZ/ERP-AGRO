// ----------------------------------------------------------------------------
//  Sjednocený model rolí (viz packages/db/DESIGN.md kap. 1–2).
//  Mapování původních rolí:
//    Plánování ADMIN → admin, NADRIZENY → editor, NAHLED → viewer
//    Konstrukce write → editor, read → viewer
//    Poptávky Person (účet) → editor
// ----------------------------------------------------------------------------

export const ROLES = ["admin", "editor", "vedouci", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrátor",
  editor: "Zapisovat",
  vedouci: "Vedoucí",
  viewer: "Číst",
};

// Oddělení jsou nově rozdělená do dvou hlavních kapitol – Dílna a Kancelář.
export const ODDELENI = [
  // Kapitola Dílna
  "vyroba",
  "montaz",
  "elektro",
  // Kapitola Kancelář
  "kancelar",
  "obchod",
  "konstrukce",
  "projektak",
  "elektro_projektant",
  "programator",
] as const;
export type Oddeleni = (typeof ODDELENI)[number];

export const ODDELENI_LABELS: Record<Oddeleni, string> = {
  vyroba: "Výroba",
  montaz: "Montáž",
  elektro: "Elektro",
  kancelar: "Kancelář",
  obchod: "Obchod",
  konstrukce: "Konstrukce",
  projektak: "Projekťák",
  elektro_projektant: "Elektro projektant",
  programator: "Programátor",
};

// Dvě hlavní kapitoly. Dílna = fyzická výroba (nepřihlašuje se), Kancelář = zbytek.
export type Kapitola = "dilna" | "kancelar";
export const KAPITOLY: Kapitola[] = ["dilna", "kancelar"];
export const KAPITOLA_LABELS: Record<Kapitola, string> = {
  dilna: "Dílna",
  kancelar: "Kancelář",
};
export const ODDELENI_KAPITOLA: Record<Oddeleni, Kapitola> = {
  vyroba: "dilna",
  montaz: "dilna",
  elektro: "dilna",
  kancelar: "kancelar",
  obchod: "kancelar",
  konstrukce: "kancelar",
  projektak: "kancelar",
  elektro_projektant: "kancelar",
  programator: "kancelar",
};

/** Patří oddělení pod kapitolu Dílna? (fyzická výroba – nepřihlašuje se) */
export function jeDilna(oddeleni: string | null | undefined): boolean {
  return !!oddeleni && ODDELENI_KAPITOLA[oddeleni as Oddeleni] === "dilna";
}

/** editor a admin smí zapisovat provozní data (vedoucí i viewer jen čtou) */
export function canWrite(role: Role): boolean {
  return role === "editor" || role === "admin";
}

/** jen admin spravuje uživatele (karta Správa) */
export function isAdmin(role: Role): boolean {
  return role === "admin";
}

export interface Profile {
  id: string;
  authUserId: string | null;
  email: string;
  name: string;
  role: Role;
  oddeleni: Oddeleni | null;
  /** lze přiřazovat na úkoly/zakázky (dřívější has_tile / řešitel) */
  assignable: boolean;
  /** 0–9, paleta dlaždic z Konstrukce */
  colorIndex: number | null;
  tileOrder: number | null;
  active: boolean;
}
