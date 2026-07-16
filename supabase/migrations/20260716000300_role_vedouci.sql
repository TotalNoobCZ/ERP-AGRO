-- ============================================================================
--  20260716000300_role_vedouci.sql
--  Nová role „Vedoucí" – jen čtení (jako viewer), ale smí být přiřazena
--  jako vedoucí projektu a odpovědná osoba poptávky.
-- ============================================================================
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'editor', 'vedouci', 'viewer'));
