-- ============================================================================
--  0001_profiles.sql
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
  email         text not null unique,
  name          text not null,
  role          text not null default 'viewer'
                  check (role in ('admin', 'editor', 'viewer')),
  oddeleni      text
                  check (oddeleni in ('obchod', 'dilna', 'kancelar', 'elektro', 'konstrukce')),
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
