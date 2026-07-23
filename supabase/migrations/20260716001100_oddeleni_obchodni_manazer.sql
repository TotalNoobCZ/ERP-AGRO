-- Nové oddělení „Obchodní manažer" (kapitola Kancelář). Může být odpovědnou
-- osobou za poptávku (viz aplikační logika poptávek).
alter table public.profiles drop constraint if exists profiles_oddeleni_check;
alter table public.profiles
  add constraint profiles_oddeleni_check
  check (oddeleni in ('vyroba', 'montaz', 'elektro', 'kancelar', 'obchod', 'obchodni_manazer', 'konstrukce', 'projektak', 'elektro_projektant', 'programator'));
