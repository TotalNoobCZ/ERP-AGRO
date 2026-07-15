-- ============================================================================
--  seed/0001_first_admin.sql
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
