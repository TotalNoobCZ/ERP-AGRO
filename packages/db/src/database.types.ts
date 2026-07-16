// ----------------------------------------------------------------------------
//  TypeScript typy databáze pro typovaný supabase-js klient.
//  DOČASNĚ psané ručně podle migrations/*.sql. Jakmile poběží Supabase projekt,
//  nahradí se generovanými: `supabase gen types typescript > src/database.types.ts`
//  (struktura je záměrně stejná, výměna bude drop-in).
// ----------------------------------------------------------------------------

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Pomocný tvar tabulky: Insert/Update odvozené z Row.
type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableShape<Row, Required extends keyof Row = never, Rels extends Rel[] = []> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: Rels;
};

// Zkratka pro běžný FK vztah (embed přes sloupec → cizí tabulka.id).
type Fk<Col extends string, Table extends string> = {
  foreignKeyName: `${string}_${Col}_fkey`;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Table;
  referencedColumns: ["id"];
};

// ---------- Row typy (sloupce 1:1 dle migrací) ----------

export type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  name: string;
  role: "admin" | "editor" | "vedouci" | "viewer";
  oddeleni:
    | "vyroba"
    | "montaz"
    | "elektro"
    | "kancelar"
    | "obchod"
    | "konstrukce"
    | "projektak"
    | "elektro_projektant"
    | "programator"
    | null;
  assignable: boolean;
  color_index: number | null;
  tile_order: number | null;
  active: boolean;
  pozice: string | null;
  osobni_cislo: string | null;
  poznamka: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export type ContactRow = {
  id: string;
  customer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export type InquiryStatusDb =
  | "NOVA"
  | "V_JEDNANI"
  | "ODESLANA"
  | "NEREAGUJE"
  | "OBJEDNANO"
  | "ZAMITNUTO";

export type InquiryRow = {
  id: string;
  number: number;
  received_at: string;
  subject: string;
  description: string | null;
  source: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: InquiryStatusDb;
  deadline: string | null;
  customer_id: string;
  person_id: string | null;
  reminder_sent: boolean;
  expired_notified: boolean;
  needs_contact: boolean;
  created_at: string;
  updated_at: string;
}

export type CommentRow = {
  id: string;
  inquiry_id: string;
  text: string;
  author: string;
  created_at: string;
}

export type StatusLogRow = {
  id: string;
  inquiry_id: string;
  from_status: InquiryStatusDb | null;
  to_status: InquiryStatusDb;
  changed_by: string;
  note: string | null;
  created_at: string;
}

export type StavZakazkyDb = "AKTIVNI" | "POZASTAVENO" | "DOKONCENO" | "ARCHIV";
export type TypMilnikuDb =
  | "ZAHAJENI_VYROBY"
  | "PREDANI_LAKOVANI"
  | "UKONCENI_VYROBY"
  | "UKONCENI_LAKOVANI";
export type TypZmenyDb = "VYTVORENI" | "UPRAVA" | "SMAZANI" | "PRODLOUZENI" | "ARCHIVACE";

export type ZakazkaRow = {
  id: string;
  kod: string;
  misto_plneni: string;
  priorita: number;
  zacatek: string;
  konec_puvodni: string;
  konec_aktualni: string;
  stav: StavZakazkyDb;
  archivovano_kdy: string | null;
  poznamka: string | null;
  zalozil_id: string;
  archivoval_id: string | null;
  odpovedna_osoba_id: string | null;
  inquiry_id: string | null;
  customer_id: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type MilnikRow = {
  id: string;
  zakazka_id: string;
  typ: TypMilnikuDb;
  datum: string;
  cas: string | null;
  poznamka: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PrirazeniZakazkaRow = {
  id: string;
  zakazka_id: string;
  osoba_id: string;
  datum_od: string;
  datum_do: string;
  created_at: string;
  deleted_at: string | null;
}

export type PrirazeniMilnikRow = {
  id: string;
  milnik_id: string;
  osoba_id: string;
  created_at: string;
  deleted_at: string | null;
}

export type PreruseniRow = {
  id: string;
  zakazka_id: string;
  datum_od: string;
  datum_do: string | null;
  zbyvajici_dny: number;
  duvod: string;
  prerusil_id: string;
  obnovil_id: string | null;
  created_at: string;
}

export type ProdlouzeniRow = {
  id: string;
  zakazka_id: string;
  stary_konec: string;
  novy_konec: string;
  duvod: string;
  provedl_id: string;
  created_at: string;
}

export type AkcePoznamkaRow = {
  id: string;
  zakazka_id: string;
  uzivatel_id: string;
  text: string;
  created_at: string;
  deleted_at: string | null;
}

export type AuditLogRow = {
  id: string;
  entita: string;
  entita_id: string;
  typ_zmeny: TypZmenyDb;
  puvodni_hodnota: Json | null;
  nova_hodnota: Json | null;
  uzivatel_id: string;
  created_at: string;
}

export type ProjectRow = {
  id: string;
  zakazka_id: string;
  name: string;
  owner_id: string | null;
  status: "active" | "archived";
  archived_by: string | null;
  archived_at: string | null;
  created_at: string;
}

export type TaskRow = {
  id: string;
  project_id: string;
  name: string;
  assignee_id: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  completed: boolean;
  completed_at: string | null;
  order_in_member: number | null;
  status: "active" | "archived";
  archived_by: string | null;
  archived_at: string | null;
  created_at: string;
}

export type TaskNoteRow = {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export type TaskTodoRow = {
  id: string;
  task_id: string;
  body: string;
  done: boolean;
  position: number | null;
}

export type ProjectNoteRow = {
  id: string;
  project_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export type ProjectTodoRow = {
  id: string;
  project_id: string;
  body: string;
  done: boolean;
  position: number | null;
}

export type AbsenceRow = {
  id: string;
  profile_id: string;
  type: "dovolena" | "nemoc" | "lekar" | "muj_den";
  start_date: string;
  end_date: string;
}

// ---------- Database typ pro supabase-js ----------

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow, "name">;
      customers: TableShape<CustomerRow, "name">;
      contacts: TableShape<ContactRow, "customer_id" | "name", [Fk<"customer_id", "customers">]>;
      inquiries: TableShape<
        InquiryRow,
        "subject" | "customer_id",
        [Fk<"customer_id", "customers">, Fk<"person_id", "profiles">]
      >;
      comments: TableShape<CommentRow, "inquiry_id" | "text" | "author", [Fk<"inquiry_id", "inquiries">]>;
      status_logs: TableShape<
        StatusLogRow,
        "inquiry_id" | "to_status" | "changed_by",
        [Fk<"inquiry_id", "inquiries">]
      >;
      zakazky: TableShape<
        ZakazkaRow,
        "kod" | "misto_plneni" | "priorita" | "zacatek" | "konec_puvodni" | "konec_aktualni" | "zalozil_id",
        [
          Fk<"zalozil_id", "profiles">,
          Fk<"archivoval_id", "profiles">,
          Fk<"odpovedna_osoba_id", "profiles">,
          Fk<"inquiry_id", "inquiries">,
          Fk<"customer_id", "customers">,
        ]
      >;
      milniky: TableShape<MilnikRow, "zakazka_id" | "typ" | "datum", [Fk<"zakazka_id", "zakazky">]>;
      prirazeni_zakazka: TableShape<
        PrirazeniZakazkaRow,
        "zakazka_id" | "osoba_id" | "datum_od" | "datum_do",
        [Fk<"zakazka_id", "zakazky">, Fk<"osoba_id", "profiles">]
      >;
      prirazeni_milnik: TableShape<
        PrirazeniMilnikRow,
        "milnik_id" | "osoba_id",
        [Fk<"milnik_id", "milniky">, Fk<"osoba_id", "profiles">]
      >;
      preruseni: TableShape<
        PreruseniRow,
        "zakazka_id" | "datum_od" | "zbyvajici_dny" | "duvod" | "prerusil_id",
        [Fk<"zakazka_id", "zakazky">, Fk<"prerusil_id", "profiles">, Fk<"obnovil_id", "profiles">]
      >;
      prodlouzeni: TableShape<
        ProdlouzeniRow,
        "zakazka_id" | "stary_konec" | "novy_konec" | "duvod" | "provedl_id",
        [Fk<"zakazka_id", "zakazky">, Fk<"provedl_id", "profiles">]
      >;
      akce_poznamky: TableShape<
        AkcePoznamkaRow,
        "zakazka_id" | "uzivatel_id" | "text",
        [Fk<"zakazka_id", "zakazky">, Fk<"uzivatel_id", "profiles">]
      >;
      audit_log: TableShape<
        AuditLogRow,
        "entita" | "entita_id" | "typ_zmeny" | "uzivatel_id",
        [Fk<"uzivatel_id", "profiles">]
      >;
      projects: TableShape<
        ProjectRow,
        "zakazka_id" | "name",
        [Fk<"zakazka_id", "zakazky">, Fk<"owner_id", "profiles">, Fk<"archived_by", "profiles">]
      >;
      tasks: TableShape<
        TaskRow,
        "project_id" | "name",
        [Fk<"project_id", "projects">, Fk<"assignee_id", "profiles">, Fk<"archived_by", "profiles">]
      >;
      task_notes: TableShape<TaskNoteRow, "task_id" | "body", [Fk<"task_id", "tasks">, Fk<"author_id", "profiles">]>;
      task_todos: TableShape<TaskTodoRow, "task_id" | "body", [Fk<"task_id", "tasks">]>;
      project_notes: TableShape<
        ProjectNoteRow,
        "project_id" | "body",
        [Fk<"project_id", "projects">, Fk<"author_id", "profiles">]
      >;
      project_todos: TableShape<ProjectTodoRow, "project_id" | "body", [Fk<"project_id", "projects">]>;
      absences: TableShape<AbsenceRow, "profile_id" | "type" | "start_date" | "end_date", [Fk<"profile_id", "profiles">]>;
    };
    Views: Record<string, never>;
    Functions: {
      current_profile_role: { Args: Record<string, never>; Returns: string | null };
      current_profile_id: { Args: Record<string, never>; Returns: string | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      can_write: { Args: Record<string, never>; Returns: boolean };
      has_profile: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
