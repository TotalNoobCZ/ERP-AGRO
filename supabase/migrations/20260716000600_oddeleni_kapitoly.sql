-- ============================================================================
--  20260716000600_oddeleni_kapitoly.sql
--  Oddělení rozdělena do dvou kapitol (Dílna / Kancelář).
--  Dílna: vyroba, montaz, elektro. Kancelář: kancelar, obchod, konstrukce,
--  projektak, elektro_projektant, programator.
--  Původní generická „dilna" se přemapuje na „vyroba".
-- ============================================================================
alter table profiles drop constraint if exists profiles_oddeleni_check;

update profiles set oddeleni = 'vyroba' where oddeleni = 'dilna';

alter table profiles add constraint profiles_oddeleni_check
  check (oddeleni in (
    'vyroba', 'montaz', 'elektro',
    'kancelar', 'obchod', 'konstrukce', 'projektak', 'elektro_projektant', 'programator'
  ));
