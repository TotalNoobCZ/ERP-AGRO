-- ============================================================================
--  20260716000500_assignable_default_true.sql
--  „Lze přiřazovat" je nově automatické u všech uživatelů (zbytečné pole).
--  Výchozí hodnota true + narovnání stávajících záznamů.
-- ============================================================================
alter table profiles alter column assignable set default true;
update profiles set assignable = true where assignable = false;
