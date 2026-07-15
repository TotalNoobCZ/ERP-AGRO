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
