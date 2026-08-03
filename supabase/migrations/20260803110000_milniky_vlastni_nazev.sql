-- ============================================================================
--  20260803110000_milniky_vlastni_nazev.sql
--  Volné milníky (vlastní název) – hlavně u montáže/demontáže. Přidán sloupec
--  nazev a typ 'VLASTNI'; u typu VLASTNI drží název text v nazev.
-- ============================================================================

alter table milniky add column if not exists nazev text;

alter table milniky drop constraint if exists milniky_typ_check;
alter table milniky add constraint milniky_typ_check
  check (typ in (
    'ZAHAJENI_VYROBY','PREDANI_LAKOVANI','UKONCENI_VYROBY','UKONCENI_LAKOVANI',
    'MONTAZ_ZACATEK','MONTAZ_KONEC','DEMONTAZ_ZACATEK','DEMONTAZ_KONEC','EXPEDICE',
    'VLASTNI'
  ));
