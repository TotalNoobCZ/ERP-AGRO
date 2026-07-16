-- ============================================================================
--  ERP AGRO – kompletní setup cloud databáze (vygenerováno z supabase/)
--  Vlož celé do: Supabase Dashboard → SQL Editor → Run.
--  Obsah: 6 migrací (schéma + RLS) + seed adminů. Jen pro PRÁZDNÝ projekt.
--  Zdroj pravdy jsou supabase/migrations/*.sql – tento soubor negeneruj ručně.
-- ============================================================================

-- ####################  20260715000100_profiles.sql  ####################

-- ============================================================================
--  20260715000100_profiles.sql
--  Sjednocený model lidí pro celý ERP systém.
--  Nahrazuje tři původní modely: Person (Poptávky), Osoba+Uzivatel (Plánování),
--  profiles (Konstrukce). Jedna tabulka napojená na Supabase Auth.
-- ============================================================================

-- Sdílená funkce pro automatické updated_at (náhrada za Prisma @updatedAt).
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
--  profiles
--  DŮLEŽITÉ (odchylka od návrhu v ERP_datovy_model.md kap. 4):
--  `id` je NEZÁVISLÉ uuid (ne přímo auth.users.id). Vazba na Auth je přes
--  `auth_user_id`, které je NULL, dokud se člověk poprvé nepřihlásí.
--  Důvod: všechny tři aplikace zakládají účet PŘED prvním přihlášením
--  (vedoucí založí profil bez hesla → člověk si při 1. loginu nastaví heslo).
--  Kdyby `id = auth.users.id`, nešlo by profil vytvořit dřív, než auth.users
--  záznam existuje. Toto je bod [POTVRDIT] – viz DESIGN.md.
-- ----------------------------------------------------------------------------
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  email         text unique,   -- nepovinné: dílna se nepřihlašuje
  name          text not null,
  role          text not null default 'viewer'
                  check (role in ('admin', 'editor', 'viewer')),
  oddeleni      text
                  check (oddeleni in ('obchod', 'dilna', 'kancelar', 'elektro', 'konstrukce', 'projektak')),
  assignable    boolean not null default false,   -- lze přiřazovat na úkoly/zakázky (dřívější has_tile / řešitel)
  color_index   int,                              -- 0–9, paleta dlaždic z Konstrukce
  tile_order    int,                              -- pořadí dlaždic členů (Konstrukce)
  active        boolean not null default true,
  -- Volitelná pole převzatá z Plánování (Osoba). Můžou zůstat NULL.
  pozice        text,                             -- jen Kancelář (Plánování)
  osobni_cislo  text,
  poznamka      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_role_idx       on profiles (role);
create index profiles_oddeleni_idx   on profiles (oddeleni);
create index profiles_assignable_idx on profiles (assignable) where assignable;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ####################  20260715000200_shared_customers.sql  ####################

-- ============================================================================
--  20260715000200_shared_customers.sql
--  Sdílené entity zákazníků (z modulu Poptávky). Sdílené napříč moduly –
--  zákazník se z poptávky dědí do zakázky (viz 0004: zakazky.customer_id).
--  Předloha: Popt-vky/prisma/schema.prisma (model Customer, Contact).
-- ============================================================================

create table customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- jméno nebo název firmy
  email         text,
  phone         text,
  address       text,
  country       text,                          -- stát (předvolba telefonu)
  contact_name  text,                          -- kontaktní osoba u zákazníka
  contact_phone text,
  contact_email text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index customers_name_idx on customers (name);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- Kontaktní osoba u zákazníka (firma může mít víc kontaktů).
create table contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);

create index contacts_customer_id_idx on contacts (customer_id);

-- ####################  20260715000300_poptavky.sql  ####################

-- ============================================================================
--  20260715000300_poptavky.sql
--  Modul Poptávky. Předloha: Popt-vky/prisma/schema.prisma
--  (Inquiry, Comment, StatusLog + enum InquiryStatus).
--  Změny proti originálu:
--   - Person → profiles: inquiry.person_id odkazuje na profiles(id).
--   - stavy zachovány 1:1 (NOVA … ZAMITNUTO).
-- ============================================================================

create table inquiries (
  id               uuid primary key default gen_random_uuid(),
  number           bigint generated by default as identity unique, -- krátké pořadové číslo (#1, #2…)
  received_at      timestamptz not null default now(),
  subject          text not null,
  description      text,
  source           text,                        -- Mail / Telefon / Přímé oslovení
  contact_name     text,                         -- obchodník, který poptával
  contact_phone    text,
  contact_email    text,
  status           text not null default 'NOVA'
                     check (status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','OBJEDNANO','ZAMITNUTO')),
  deadline         timestamptz,                  -- termín pro vypracování nabídky

  customer_id      uuid not null references customers (id) on delete restrict,
  person_id        uuid not null references profiles (id)  on delete restrict, -- dřívější Person

  -- Příznaky notifikací (v Poptávkách existovaly; v ERP se maily neposílají,
  -- pole ale ponecháváme kvůli 1:1 migraci historických dat).
  reminder_sent    boolean not null default false,
  expired_notified boolean not null default false,
  needs_contact    boolean not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index inquiries_status_idx    on inquiries (status);
create index inquiries_deadline_idx  on inquiries (deadline);
create index inquiries_person_id_idx on inquiries (person_id);

create trigger inquiries_set_updated_at
  before update on inquiries
  for each row execute function set_updated_at();

-- Komentář / poznámka k poptávce.
-- Autor zůstává volným textem (jako v originále, nebyl vázán na účet).
create table comments (
  id         uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries (id) on delete cascade,
  text       text not null,
  author     text not null,
  created_at timestamptz not null default now()
);

create index comments_inquiry_id_idx on comments (inquiry_id);

-- Historie změn stavu poptávky.
create table status_logs (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references inquiries (id) on delete cascade,
  from_status text
                check (from_status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','OBJEDNANO','ZAMITNUTO')),
  to_status   text not null
                check (to_status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','OBJEDNANO','ZAMITNUTO')),
  changed_by  text not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index status_logs_inquiry_id_idx on status_logs (inquiry_id);

-- ####################  20260715000400_zakazky.sql  ####################

-- ============================================================================
--  20260715000400_zakazky.sql
--  Modul Zakázky (páteř systému) + plánování lidí.
--  Předloha: Planovani/prisma/schema.prisma
--  (Zakazka, Milnik, PrirazeniZakazka, PrirazeniMilnik, Preruseni,
--   Prodlouzeni, AkcePoznamka, AuditLog + enumy).
--  Změny proti originálu:
--   - Osoba + Uzivatel → profiles: všechny odkazy na lidi → profiles(id).
--   - NOVÉ cizí klíče (propojení modulů):
--       zakazky.inquiry_id  → inquiries(id)  (odkud zakázka vznikla)
--       zakazky.customer_id → customers(id)  (zděděný zákazník z poptávky)
-- ============================================================================

create table zakazky (
  id                 uuid primary key default gen_random_uuid(),
  kod                text not null unique,
  misto_plneni       text not null,
  priorita           int not null,              -- 1–5
  zacatek            date not null,
  konec_puvodni      date not null,
  konec_aktualni     date not null,
  stav               text not null default 'AKTIVNI'
                       check (stav in ('AKTIVNI','POZASTAVENO','DOKONCENO','ARCHIV')),
  archivovano_kdy    timestamptz,
  poznamka           text,

  zalozil_id         uuid not null references profiles (id) on delete restrict, -- dřívější zalozilUzivatel
  archivoval_id      uuid references profiles (id),
  odpovedna_osoba_id uuid references profiles (id),                             -- dřívější odpovednaOsoba

  -- NOVÉ – propojení modulů:
  inquiry_id         uuid references inquiries (id),   -- z jaké poptávky zakázka vznikla
  customer_id        uuid references customers (id),   -- zděděný zákazník

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz                       -- soft delete
);

create index zakazky_stav_idx           on zakazky (stav);
create index zakazky_konec_aktualni_idx on zakazky (konec_aktualni);
create index zakazky_kod_idx            on zakazky (kod);
create index zakazky_inquiry_id_idx     on zakazky (inquiry_id);
create index zakazky_customer_id_idx    on zakazky (customer_id);

create trigger zakazky_set_updated_at
  before update on zakazky
  for each row execute function set_updated_at();

-- Výrobní milníky (body v čase) navázané na zakázku.
create table milniky (
  id         uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references zakazky (id),
  typ        text not null
               check (typ in ('ZAHAJENI_VYROBY','PREDANI_LAKOVANI','UKONCENI_VYROBY','UKONCENI_LAKOVANI')),
  datum      date not null,
  cas        text,                              -- "HH:mm", nepovinné
  poznamka   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index milniky_zakazka_typ_idx on milniky (zakazka_id, typ);

create trigger milniky_set_updated_at
  before update on milniky
  for each row execute function set_updated_at();

-- Přiřazení osoby k zakázce (má rozsah od–do, vstupuje do kontroly kolizí).
create table prirazeni_zakazka (
  id         uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references zakazky (id),
  osoba_id   uuid not null references profiles (id),
  datum_od   date not null,
  datum_do   date not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index prirazeni_zakazka_osoba_idx   on prirazeni_zakazka (osoba_id);
create index prirazeni_zakazka_zakazka_idx on prirazeni_zakazka (zakazka_id);

-- Přiřazení osoby k milníku (bez rozsahu, nevstupuje do kolizí).
create table prirazeni_milnik (
  id         uuid primary key default gen_random_uuid(),
  milnik_id  uuid not null references milniky (id),
  osoba_id   uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index prirazeni_milnik_milnik_idx on prirazeni_milnik (milnik_id);

-- Přerušení (pozastavení) zakázky s pozdějším obnovením.
create table preruseni (
  id            uuid primary key default gen_random_uuid(),
  zakazka_id    uuid not null references zakazky (id),
  datum_od      date not null,                  -- začátek přerušení
  datum_do      date,                           -- obnovení (null = stále přerušeno)
  zbyvajici_dny int not null,
  duvod         text not null,
  prerusil_id   uuid not null references profiles (id),
  obnovil_id    uuid references profiles (id),
  created_at    timestamptz not null default now()
);

create index preruseni_zakazka_idx on preruseni (zakazka_id);

-- Historie prodloužení termínu.
create table prodlouzeni (
  id          uuid primary key default gen_random_uuid(),
  zakazka_id  uuid not null references zakazky (id),
  stary_konec date not null,
  novy_konec  date not null,
  duvod       text not null,
  provedl_id  uuid not null references profiles (id),
  created_at  timestamptz not null default now()
);

create index prodlouzeni_zakazka_idx on prodlouzeni (zakazka_id);

-- Poznámky k zakázce (více poznámek, každá s autorem a časem).
create table akce_poznamky (
  id          uuid primary key default gen_random_uuid(),
  zakazka_id  uuid not null references zakazky (id),
  uzivatel_id uuid not null references profiles (id),
  text        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index akce_poznamky_zakazka_idx on akce_poznamky (zakazka_id);

-- Auditní log změn (modul Zakázky).
create table audit_log (
  id              uuid primary key default gen_random_uuid(),
  entita          text not null,                -- "zakazka" | "milnik" | "prirazeni" | "osoba"
  entita_id       text not null,
  typ_zmeny       text not null
                    check (typ_zmeny in ('VYTVORENI','UPRAVA','SMAZANI','PRODLOUZENI','ARCHIVACE')),
  puvodni_hodnota jsonb,
  nova_hodnota    jsonb,
  uzivatel_id     uuid not null references profiles (id),
  created_at      timestamptz not null default now()
);

create index audit_log_entita_idx on audit_log (entita, entita_id);

-- ####################  20260715000500_konstrukce.sql  ####################

-- ============================================================================
--  20260715000500_konstrukce.sql
--  Modul Konstrukce (Gantt, dlaždice, kolizní engine).
--  Předloha: ZADANI.md kap. 4 (datový model konstrukční aplikace).
--  Změny proti originálu:
--   - profiles.role read/write, has_tile, tile_order, color_index, auth_user_id
--     jsou sjednoceny do globální tabulky profiles (viz 0001).
--   - NOVÉ: projects.zakazka_id NOT NULL – konstrukční projekt VŽDY patří
--     k výrobní zakázce (rozhodnuto v ERP_datovy_model.md kap. 5).
--  Pozn.: "Archiv" není tabulka, je to pohled na řádky se status = 'archived'.
-- ============================================================================

create table projects (
  id          uuid primary key default gen_random_uuid(),
  -- NOVÉ – propojení modulů. NOT NULL: projekt nelze založit bez zakázky.
  zakazka_id  uuid not null references zakazky (id),
  name        text not null,
  owner_id    uuid references profiles (id),          -- "Zodpovídá"
  status      text not null default 'active'
                check (status in ('active','archived')),
  archived_by uuid references profiles (id),
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create index projects_zakazka_id_idx on projects (zakazka_id);
create index projects_owner_id_idx   on projects (owner_id);
create index projects_status_idx     on projects (status);

create table tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects (id) on delete cascade,
  name            text not null,
  assignee_id     uuid references profiles (id),       -- "Přiřazeno" (nullable)
  start_date      date,
  end_date        date,
  duration_days   int,                                 -- pracovní dny
  completed       boolean not null default false,
  completed_at    timestamptz,
  order_in_member int,                                 -- pořadí v dlaždici řešitele / řádcích Ganttu
  status          text not null default 'active'
                    check (status in ('active','archived')),
  archived_by     uuid references profiles (id),
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index tasks_project_id_idx  on tasks (project_id);
create index tasks_assignee_id_idx on tasks (assignee_id);
create index tasks_status_idx      on tasks (status);

-- Poznámky k úkolu (timeline: kdo a kdy zapsal).
create table task_notes (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks (id) on delete cascade,
  author_id  uuid references profiles (id),
  body       text not null,
  created_at timestamptz not null default now()
);

create index task_notes_task_id_idx on task_notes (task_id);

-- Todo položky úkolu.
create table task_todos (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid not null references tasks (id) on delete cascade,
  body     text not null,
  done     boolean not null default false,
  position int
);

create index task_todos_task_id_idx on task_todos (task_id);

-- Poznámky k projektu (timeline).
create table project_notes (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  author_id  uuid references profiles (id),
  body       text not null,
  created_at timestamptz not null default now()
);

create index project_notes_project_id_idx on project_notes (project_id);

-- Todo položky projektu.
create table project_todos (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  body       text not null,
  done       boolean not null default false,
  position   int
);

create index project_todos_project_id_idx on project_todos (project_id);

-- Absence členů (celé pracovní dny, včetně). Propisují se do Ganttu.
create table absences (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  type       text not null
               check (type in ('dovolena','nemoc','lekar','muj_den')),
  start_date date not null,
  end_date   date not null
);

create index absences_profile_id_idx on absences (profile_id);

-- ####################  20260715000600_rls.sql  ####################

-- ============================================================================
--  20260715000600_rls.sql
--  Row Level Security pro celý ERP systém.
--  Model rolí (viz DESIGN.md):
--    viewer  – jen čtení (SELECT) všude; změna vlastního hesla je na úrovni
--              Supabase Auth (auth.users), ne v těchto tabulkách.
--    editor  – čtení + zápis (INSERT/UPDATE/DELETE) provozních tabulek,
--              NEspravuje uživatele.
--    admin   – vše, včetně správy uživatelů (zápis do profiles).
--
--  Pozn.: Supabase role `service_role` má BYPASSRLS – používá ji server pro
--  akce mimo běžného uživatele (napojení auth_user_id při 1. loginu, migrace dat).
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Pomocné funkce (SECURITY DEFINER → obcházejí RLS na profiles, aby nevznikla
--  rekurze při čtení vlastní role z politik nad profiles).
-- ----------------------------------------------------------------------------
create or replace function current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where auth_user_id = auth.uid() and active;
$$;

create or replace function current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where auth_user_id = auth.uid() and active;
$$;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select current_profile_role() = 'admin';
$$;

create or replace function can_write()
returns boolean
language sql
stable
as $$
  select current_profile_role() in ('editor', 'admin');
$$;

-- Má přihlášený uživatel platný (aktivní) profil? = smí číst.
create or replace function has_profile()
returns boolean
language sql
stable
as $$
  select current_profile_role() is not null;
$$;

-- ----------------------------------------------------------------------------
--  Provozní tabulky: SELECT pro každý profil, zápis pro editor/admin.
--  (subselect kolem funkcí = init-plan cache na příkaz, doporučeno Supabase.)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  business_tables text[] := array[
    'customers', 'contacts',
    'inquiries', 'comments', 'status_logs',
    'zakazky', 'milniky', 'prirazeni_zakazka', 'prirazeni_milnik',
    'preruseni', 'prodlouzeni', 'akce_poznamky',
    'projects', 'tasks', 'task_notes', 'task_todos',
    'project_notes', 'project_todos', 'absences'
  ];
begin
  foreach t in array business_tables loop
    execute format('alter table %I enable row level security;', t);

    execute format($f$
      create policy %I on %I
        for select to authenticated
        using ((select has_profile()));
    $f$, t || '_select', t);

    execute format($f$
      create policy %I on %I
        for insert to authenticated
        with check ((select can_write()));
    $f$, t || '_insert', t);

    execute format($f$
      create policy %I on %I
        for update to authenticated
        using ((select can_write()))
        with check ((select can_write()));
    $f$, t || '_update', t);

    execute format($f$
      create policy %I on %I
        for delete to authenticated
        using ((select can_write()));
    $f$, t || '_delete', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
--  profiles: čtení pro každý profil (kvůli nabídkám „Přiřazeno"/„Zodpovídá"),
--  zápis (zakládání a úprava uživatelů) jen admin.
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;

create policy profiles_select on profiles
  for select to authenticated
  using ((select has_profile()));

create policy profiles_insert on profiles
  for insert to authenticated
  with check ((select is_admin()));

create policy profiles_update on profiles
  for update to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

create policy profiles_delete on profiles
  for delete to authenticated
  using ((select is_admin()));

-- ----------------------------------------------------------------------------
--  audit_log: čtení pro každý profil, zápis pro editor/admin.
--  Bez UPDATE/DELETE – log je neměnný.
-- ----------------------------------------------------------------------------
alter table audit_log enable row level security;

create policy audit_log_select on audit_log
  for select to authenticated
  using ((select has_profile()));

create policy audit_log_insert on audit_log
  for insert to authenticated
  with check ((select can_write()));

-- ####################  seed.sql  ####################

-- ============================================================================
--  supabase/seed.sql
--  Zakládající admini ERP systému. Profily se zakládají BEZ hesla
--  (auth_user_id = null) – heslo si nastaví při 1. přihlášení ("Jsem tu poprvé").
--  Spusť ručně po migracích. Idempotentní (on conflict do nothing).
--
--  Ostatní uživatelé se zakládají přes UI (karta Správa) s rolí editor / viewer.
-- ============================================================================

insert into profiles (email, name, role, oddeleni, assignable, color_index, active)
values
  -- Jakub Roháč (ZADANI.md kap. 10)
  ('rohac@agrocs.cz', 'Jakub Roháč', 'admin', 'konstrukce', true, 0, true),
  -- Kryštof Harant – druhý admin
  ('harantk@agrocs.cz', 'Kryštof Harant', 'admin', 'konstrukce', true, 1, true)
on conflict (email) do nothing;
