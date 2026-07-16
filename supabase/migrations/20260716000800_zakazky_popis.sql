-- ============================================================================
--  20260716000800_zakazky_popis.sql
--  Volitelný popis zakázky („oč se jedná"). U podzakázek se zobrazuje vedle
--  čísla; číslo zakázky zůstává hlavní identifikátor.
-- ============================================================================
alter table zakazky add column popis text;
