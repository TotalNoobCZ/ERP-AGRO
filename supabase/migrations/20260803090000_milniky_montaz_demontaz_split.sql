-- ============================================================================
--  20260803090000_milniky_montaz_demontaz_split.sql
--  Montáž a demontáž rozděleny na začátek a konec:
--  MONTAZ → MONTAZ_ZACATEK/MONTAZ_KONEC, DEMONTAZ → DEMONTAZ_ZACATEK/…_KONEC.
--  Pořadí: DROP constraint → přemapovat případná stará data → ADD nový.
-- ============================================================================

alter table milniky drop constraint if exists milniky_typ_check;

update milniky set typ = 'MONTAZ_ZACATEK'   where typ = 'MONTAZ';
update milniky set typ = 'DEMONTAZ_ZACATEK' where typ = 'DEMONTAZ';

alter table milniky add constraint milniky_typ_check
  check (typ in (
    'ZAHAJENI_VYROBY','PREDANI_LAKOVANI','UKONCENI_VYROBY','UKONCENI_LAKOVANI',
    'MONTAZ_ZACATEK','MONTAZ_KONEC','DEMONTAZ_ZACATEK','DEMONTAZ_KONEC','EXPEDICE'
  ));
