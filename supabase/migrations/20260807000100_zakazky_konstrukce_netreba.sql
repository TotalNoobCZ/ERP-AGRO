-- ============================================================================
--  20260807000100_zakazky_konstrukce_netreba.sql
--  Označení akce „konstrukce není třeba": akce zmizí z modulu Konstrukce
--  (přehled, plánování, výběr zakázek pro projekty), v ostatních modulech
--  zůstává beze změny. Smí šéfkonstruktér, vedoucí nebo admin; vratné.
-- ============================================================================

alter table zakazky add column if not exists konstrukce_netreba_at timestamptz;
alter table zakazky add column if not exists konstrukce_netreba_by uuid references profiles (id);
