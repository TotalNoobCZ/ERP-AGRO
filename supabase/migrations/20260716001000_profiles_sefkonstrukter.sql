-- Šéfkonstruktér: pozice s oprávněním odebírat konstruktéry ze zakázek.
-- (Odebrat konstruktéra ze zakázky smí jen šéfkonstruktér nebo administrátor.)
alter table public.profiles
  add column if not exists sefkonstrukter boolean not null default false;
