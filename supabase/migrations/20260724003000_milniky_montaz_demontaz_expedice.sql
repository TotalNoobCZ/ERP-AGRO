-- ============================================================================
--  20260724003000_milniky_montaz_demontaz_expedice.sql
--  Nové typy milníků: Montáž, Demontáž, Expedice.
-- ============================================================================

alter table milniky drop constraint if exists milniky_typ_check;
alter table milniky add constraint milniky_typ_check
  check (typ in (
    'ZAHAJENI_VYROBY','PREDANI_LAKOVANI','UKONCENI_VYROBY','UKONCENI_LAKOVANI',
    'MONTAZ','DEMONTAZ','EXPEDICE'
  ));
