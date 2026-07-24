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

-- 9) Poptávka: nový stav „Odloženo" + datum připomenutí
alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check
  check (status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','ODLOZENO','OBJEDNANO','ZAMITNUTO'));

alter table public.status_logs drop constraint if exists status_logs_from_status_check;
alter table public.status_logs add constraint status_logs_from_status_check
  check (from_status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','ODLOZENO','OBJEDNANO','ZAMITNUTO'));

alter table public.status_logs drop constraint if exists status_logs_to_status_check;
alter table public.status_logs add constraint status_logs_to_status_check
  check (to_status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','ODLOZENO','OBJEDNANO','ZAMITNUTO'));

alter table public.inquiries add column if not exists remind_at date;
create index if not exists inquiries_remind_at_idx on public.inquiries (remind_at);

-- 10) Přístupová práva k modulům (per-oddělení + per-profil)
alter table public.profiles add column if not exists access_modules text[];

create table if not exists public.department_access (
  oddeleni   text primary key
    check (oddeleni in (
      'vyroba', 'montaz', 'elektro',
      'kancelar', 'obchod', 'obchodni_manazer', 'konstrukce',
      'projektak', 'elektro_projektant', 'programator'
    )),
  modules    text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.department_access enable row level security;

drop policy if exists department_access_select on public.department_access;
create policy department_access_select on public.department_access
  for select to authenticated
  using ((select has_profile()));

drop policy if exists department_access_write on public.department_access;
create policy department_access_write on public.department_access
  for all to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

-- 11) Modul Dílna: výrobní fáze + uskladnění
alter table public.zakazky add column if not exists ulozeni text;

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

-- ============================================================================
--  12) Zakázky – fakturace a proplacení (finále akce)
--  Stav „Dokončeno" nahrazen „Fakturace"; po zaplacení „Proplaceno" = hotové.
-- ============================================================================
-- Pořadí: DROP starý constraint → UPDATE dat (bez omezení) → ADD nový.
alter table public.zakazky drop constraint if exists zakazky_stav_check;

update public.zakazky set stav = 'FAKTURACE' where stav = 'DOKONCENO';

alter table public.zakazky add constraint zakazky_stav_check
  check (stav in ('AKTIVNI', 'POZASTAVENO', 'FAKTURACE', 'PROPLACENO', 'ARCHIV'));

-- ============================================================================
--  13) Zakázky – sledování lhůty proplacení (upozornění)
--  fakturace_od = kdy akce vstoupila do stavu „Fakturace". Slouží upozornění
--  odpovědné osobě, když faktura není proplacena do 30 dní.
-- ============================================================================
alter table public.zakazky add column if not exists fakturace_od timestamptz;

update public.zakazky set fakturace_od = coalesce(updated_at, now())
  where stav = 'FAKTURACE' and fakturace_od is null;

-- ============================================================================
--  14) Backfill: zodpovědní konstruktéři projektů → pracovníci na zakázce
--  Jednorázově propíše už nastavené zodpovědné konstruktéry (projects.owner_id)
--  na zakázku jejich projektu, aby byli vidět na zakázkové tabuli i v detailu.
--  Idempotentní – koho už na zakázce máme, znovu nepřidá.
-- ============================================================================
insert into public.prirazeni_zakazka (zakazka_id, osoba_id, datum_od, datum_do)
select z.id, p.owner_id, z.zacatek, z.konec_aktualni
from public.projects p
join public.zakazky z on z.id = p.zakazka_id
where p.owner_id is not null
  and p.status = 'active'
  and z.deleted_at is null
  and not exists (
    select 1 from public.prirazeni_zakazka pz
    where pz.zakazka_id = z.id and pz.osoba_id = p.owner_id and pz.deleted_at is null
  );
