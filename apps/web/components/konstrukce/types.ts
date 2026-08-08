// Sdílené typy modulu Konstrukce (data předávaná ze server pages do klienta).

export type Clen = {
  id: string;
  name: string;
  colorIndex: number | null;
  /** vlastní barva (má přednost před colorIndex) */
  colorHex: string | null;
  tileOrder: number | null;
};

export type Poznamka = { id: string; body: string; createdAt: string; author: string | null };
export type Todo = { id: string; body: string; done: boolean; position: number | null };

export type Ukol = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  /** popis zakázky k akci, kterou podúkol reprezentuje (tasks.zakazka_id) */
  zakazkaPopis: string | null;
  /** zakázka (nebo akce projektu) je pozastavená → úkol se zobrazuje zašedle */
  pozastaveno: boolean;
  assigneeId: string | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  completed: boolean;
  orderInMember: number | null;
  notes: Poznamka[];
  todos: Todo[];
};

export type Projekt = {
  id: string;
  name: string;
  /** null u projektu poptávky (viz inquiryId) */
  zakazkaId: string | null;
  zakazkaKod: string;
  /** projekt vzešlý z poptávky (tlačítko Konstrukce na poptávce) */
  inquiryId: string | null;
  akceId: string;
  akceKod: string;
  /** zakázka projektu je pozastavená → projekt se zobrazuje zašedle */
  pozastaveno: boolean;
  ownerId: string | null;
  ownerName: string | null;
  notes: Poznamka[];
  todos: Todo[];
};

export type Absence = {
  id: string;
  profileId: string;
  type: string;
  startDate: string;
  endDate: string;
};
