-- ============================================================================
--  20260807000200_profiles_jmeno_prijmeni.sql
--  Rozdělení jména zaměstnance na jméno + příjmení (karta ve Správě má dvě
--  kolonky). Zobrazované `name` se nově skládá jako „Příjmení Jméno" –
--  všechna místa v aplikaci (i iniciály v bublinách) tak automaticky ukazují
--  příjmení první. Backfill: poslední slovo dosavadního name = příjmení.
-- ============================================================================

alter table profiles add column if not exists jmeno text;
alter table profiles add column if not exists prijmeni text;

-- Backfill z dosavadního „Jméno Příjmení" (poslední slovo = příjmení,
-- zbytek = jméno; jednoslovná jména celá do příjmení).
update profiles set
  prijmeni = coalesce(prijmeni, (regexp_match(trim(name), '(\S+)$'))[1]),
  jmeno    = coalesce(jmeno, nullif(trim(regexp_replace(trim(name), '\s*\S+$', '')), ''))
where name is not null and trim(name) <> '';

-- Zobrazované name = „Příjmení Jméno".
update profiles
set name = trim(coalesce(prijmeni, '') || ' ' || coalesce(jmeno, ''))
where coalesce(prijmeni, '') <> '';
