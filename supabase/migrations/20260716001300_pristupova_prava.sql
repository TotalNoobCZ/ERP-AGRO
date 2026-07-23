-- Přístupová práva k modulům („kartám"). Admin nastavuje plošně dle oddělení
-- (department_access) i jednotlivě u profilu (profiles.access_modules).

-- 1) Vlastní nastavení modulů u profilu (NULL = zdědit výchozí dle oddělení)
alter table public.profiles add column if not exists access_modules text[];

-- 2) Výchozí přístup dle oddělení
create table if not exists public.department_access (
  oddeleni   text primary key
    check (oddeleni in (
      'vyroba', 'montaz', 'elektro',
      'kancelar', 'obchod', 'obchodni_manazer', 'konstrukce',
      'projektak', 'elektro_projektant', 'programator'
    )),
  modules    text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.department_access enable row level security;

-- Čtení pro každý přihlášený profil, zápis jen admin.
drop policy if exists department_access_select on public.department_access;
create policy department_access_select on public.department_access
  for select to authenticated
  using ((select has_profile()));

drop policy if exists department_access_write on public.department_access;
create policy department_access_write on public.department_access
  for all to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));
