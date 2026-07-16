-- ============================================================================
--  20260716000700_zakazky_podzakazky.sql
--  Podzakázky: jedna „hlavní akce" může sdružovat víc dceřiných zakázek.
--  Podzakázka je plnohodnotná zakázka s vlastním číslem, jen ukazuje na rodiče.
-- ============================================================================
alter table zakazky add column parent_id uuid references zakazky (id);
create index zakazky_parent_id_idx on zakazky (parent_id);
