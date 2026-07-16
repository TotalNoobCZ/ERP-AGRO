-- ============================================================================
--  20260716000900_tasks_zakazka.sql
--  Konstrukční podúkol může reprezentovat konkrétní zakázku k akci.
--  zakazka_id = ta zakázka (null = obecný úkol projektu / celé akce).
--  Díky tomu se konstruktér přiřazený k podúkolu propíše ke správné zakázce.
-- ============================================================================
alter table tasks add column zakazka_id uuid references zakazky (id);
create index tasks_zakazka_id_idx on tasks (zakazka_id);
