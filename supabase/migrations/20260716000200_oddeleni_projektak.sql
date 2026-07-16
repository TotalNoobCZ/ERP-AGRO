-- ============================================================================
--  20260716000200_oddeleni_projektak.sql
--  Nové oddělení „Projekťák" – smí být vedoucím konstrukčního projektu.
-- ============================================================================
alter table profiles drop constraint if exists profiles_oddeleni_check;
alter table profiles add constraint profiles_oddeleni_check
  check (oddeleni in ('obchod', 'dilna', 'kancelar', 'elektro', 'konstrukce', 'projektak'));
