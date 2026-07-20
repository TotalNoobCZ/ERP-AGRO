-- ============================================================================
--  APPLY_ON_CLOUD.sql — jednorázově spustit na cloudové Supabase DB.
--  Dožene schéma na úroveň aplikace (všechny migrace 20260716*).
--  Vše je IDEMPOTENTNÍ – lze spustit opakovaně bez chyby.
--  Supabase → SQL Editor → vložit → Run.
-- ============================================================================

-- 1) E-mail nepovinný (dílna se nepřihlašuje)
alter table public.profiles alter column email drop not null;

-- 2) Role: doplněna „vedouci"
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'editor', 'vedouci', 'viewer'));

-- 3) Oddělení: kapitoly + projekťák + Obchodní manažer; „dilna“ → „vyroba“
update public.profiles set oddeleni = 'vyroba' where oddeleni = 'dilna';
alter table public.profiles drop constraint if exists profiles_oddeleni_check;
alter table public.profiles add constraint profiles_oddeleni_check
  check (oddeleni in (
    'vyroba', 'montaz', 'elektro',
    'kancelar', 'obchod', 'obchodni_manazer', 'konstrukce',
    'projektak', 'elektro_projektant', 'programator'
  ));

-- 4) „Lze přiřazovat“ automaticky u všech
alter table public.profiles alter column assignable set default true;
update public.profiles set assignable = true where assignable = false;

-- 5) Šéfkonstruktér (pozice s právem odebírat konstruktéry ze zakázek)
alter table public.profiles add column if not exists sefkonstrukter boolean not null default false;

-- 6) Poptávka: odpovědná osoba nepovinná
alter table public.inquiries alter column person_id drop not null;

-- 7) Zakázky k akci (podzakázky) + popis
alter table public.zakazky add column if not exists parent_id uuid references public.zakazky (id);
create index if not exists zakazky_parent_id_idx on public.zakazky (parent_id);
alter table public.zakazky add column if not exists popis text;

-- 8) Konstrukční podúkol může reprezentovat konkrétní zakázku k akci
alter table public.tasks add column if not exists zakazka_id uuid references public.zakazky (id);
create index if not exists tasks_zakazka_id_idx on public.tasks (zakazka_id);
