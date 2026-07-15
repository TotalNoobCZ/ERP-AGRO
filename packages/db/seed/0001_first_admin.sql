-- ============================================================================
--  seed/0001_first_admin.sql
--  První uživatel dle ZADANI.md kap. 10: Jakub Roháč.
--  Založí se profil BEZ hesla (auth_user_id = null) – heslo si nastaví při
--  prvním přihlášení ("Jsem tu poprvé"). Role = admin (viz DESIGN.md 2.2).
--  Spusť ručně po migracích. Idempotentní (on conflict do nothing).
-- ============================================================================

insert into profiles (email, name, role, oddeleni, assignable, color_index, active)
values ('rohac@agrocs.cz', 'Jakub Roháč', 'admin', 'konstrukce', true, 0, true)
on conflict (email) do nothing;
