// Sdílené typy modulu Konstrukce (data předávaná ze server pages do klienta).

export type Clen = {
  id: string;
  name: string;
  colorIndex: number | null;
  tileOrder: number | null;
};

export type Poznamka = { id: string; body: string; createdAt: string; author: string | null };
export type Todo = { id: string; body: string; done: boolean; position: number | null };

export type Ukol = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
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
  zakazkaId: string;
  zakazkaKod: string;
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
