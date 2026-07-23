-- Modul Dílna: výrobní fáze (Pálení a příprava / Svařování / Lakovna / Montáž)
-- s termíny od–do a evidence uskladnění dílu/stroje. Přiřazování lidí využívá
-- stávající prirazeni_zakazka (propisuje se do Zakázek).

-- 1) Uskladnění dílu/stroje u zakázky
alter table public.zakazky add column if not exists ulozeni text;

-- 2) Výrobní fáze zakázky (max. jedna od každého typu na zakázku)
create table if not exists public.dilna_faze (
  id         uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky (id) on delete cascade,
  typ        text not null
               check (typ in ('PALENI_PRIPRAVA', 'SVAROVANI', 'LAKOVNA', 'MONTAZ')),
  datum_od   date,
  datum_do   date,
  poznamka   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dilna_faze_zakazka_typ_uidx on public.dilna_faze (zakazka_id, typ);

-- RLS: čtení pro každý profil, zápis pro editor/admin (jako ostatní provozní data).
alter table public.dilna_faze enable row level security;

drop policy if exists dilna_faze_select on public.dilna_faze;
create policy dilna_faze_select on public.dilna_faze
  for select to authenticated using ((select has_profile()));

drop policy if exists dilna_faze_insert on public.dilna_faze;
create policy dilna_faze_insert on public.dilna_faze
  for insert to authenticated with check ((select can_write()));

drop policy if exists dilna_faze_update on public.dilna_faze;
create policy dilna_faze_update on public.dilna_faze
  for update to authenticated using ((select can_write())) with check ((select can_write()));

drop policy if exists dilna_faze_delete on public.dilna_faze;
create policy dilna_faze_delete on public.dilna_faze
  for delete to authenticated using ((select can_write()));
