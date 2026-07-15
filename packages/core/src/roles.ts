// ----------------------------------------------------------------------------
//  Sjednocený model rolí (viz packages/db/DESIGN.md kap. 1–2).
//  Mapování původních rolí:
//    Plánování ADMIN → admin, NADRIZENY → editor, NAHLED → viewer
//    Konstrukce write → editor, read → viewer
//    Poptávky Person (účet) → editor
// ----------------------------------------------------------------------------

export const ROLES = ["admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrátor",
  editor: "Zapisovat",
  viewer: "Číst",
};

export const ODDELENI = ["obchod", "dilna", "kancelar", "elektro", "konstrukce"] as const;
export type Oddeleni = (typeof ODDELENI)[number];

export const ODDELENI_LABELS: Record<Oddeleni, string> = {
  obchod: "Obchod",
  dilna: "Dílna",
  kancelar: "Kancelář",
  elektro: "Elektro",
  konstrukce: "Konstrukce",
};

/** editor a admin smí zapisovat provozní data */
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
