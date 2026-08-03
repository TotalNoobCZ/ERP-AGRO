-- ============================================================================
--  20260803093000_akce_montaz.sql
--  Záznamy Montáž / Demontáž u akce: typ (montáž/demontáž), nepovinná zakázka
--  (text), nepovinný popis a termín od–do. RLS jako u ostatních provozních
--  tabulek: čtení pro každý profil, zápis pro editor/admin.
-- ============================================================================

create table if not exists akce_montaz (
  id          uuid primary key default gen_random_uuid(),
  zakazka_id  uuid not null references zakazky (id),
  typ         text not null check (typ in ('MONTAZ', 'DEMONTAZ')),
  zakazka_ref text,                       -- nepovinné pole „Zakázka"
  popis       text,                       -- nepovinný popis
  datum_od    date,
  datum_do    date,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists akce_montaz_zakazka_idx on akce_montaz (zakazka_id);

alter table akce_montaz enable row level security;

drop policy if exists akce_montaz_select on akce_montaz;
create policy akce_montaz_select on akce_montaz
  for select to authenticated using ((select has_profile()));

drop policy if exists akce_montaz_insert on akce_montaz;
create policy akce_montaz_insert on akce_montaz
  for insert to authenticated with check ((select can_write()));

drop policy if exists akce_montaz_update on akce_montaz;
create policy akce_montaz_update on akce_montaz
  for update to authenticated using ((select can_write())) with check ((select can_write()));

drop policy if exists akce_montaz_delete on akce_montaz;
create policy akce_montaz_delete on akce_montaz
  for delete to authenticated using ((select can_write()));
