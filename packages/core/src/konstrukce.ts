// ----------------------------------------------------------------------------
//  Modul Konstrukce – stavy, absence a labely (dle ZADANI.md).
//  Terminologie: v tomto modulu se používá „Projekt/Úkol";
//  „Zakázka" = nadřazená výrobní zakázka (projects.zakazka_id).
// ----------------------------------------------------------------------------

export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ABSENCE_TYPES = ["dovolena", "nemoc", "lekar", "muj_den"] as const;
export type AbsenceType = (typeof ABSENCE_TYPES)[number];

export const ABSENCE_LABELS: Record<AbsenceType, string> = {
  dovolena: "Dovolená",
  nemoc: "Nemoc",
  lekar: "Lékař",
  muj_den: "Můj den",
};

/** UI labely modulu (ZADANI.md kap. 6) – na jednom místě kvůli snadné změně. */
export const KONSTRUKCE_LABELS = {
  assignee: "Přiřazeno",
  owner: "Zodpovídá",
  team: "Tým",
  project: "Projekt",
  task: "Úkol",
  gantt: "Gantt",
  clean: "Vyčistit",
  archive: "Archivovat",
  restore: "Obnovit",
  deleteArchive: "Smazat archiv",
  addProject: "Přidat projekt",
} as const;
