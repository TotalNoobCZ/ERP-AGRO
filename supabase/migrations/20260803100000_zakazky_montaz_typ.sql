-- ============================================================================
--  20260803100000_zakazky_montaz_typ.sql
--  Montáž / Demontáž jako zakázka k akci (podzakázka) s příznakem typu.
--  montaz_typ = NULL u běžných zakázek, jinak 'MONTAZ' / 'DEMONTAZ'.
-- ============================================================================

alter table zakazky add column if not exists montaz_typ text
  check (montaz_typ in ('MONTAZ', 'DEMONTAZ'));
