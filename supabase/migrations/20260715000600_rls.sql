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
