-- Nový stav poptávky „ODLOZENO" (Odloženo) + datum připomenutí `remind_at`.
-- Odložená poptávka se skryje z hlavního seznamu a tabule; podle `remind_at`
-- se v čase připomene odpovědné osobě.

-- 1) Stav poptávky: doplněn „ODLOZENO"
alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries
  add constraint inquiries_status_check
  check (status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','ODLOZENO','OBJEDNANO','ZAMITNUTO'));

-- 2) Historie stavů: doplněn „ODLOZENO" do from/to
alter table public.status_logs drop constraint if exists status_logs_from_status_check;
alter table public.status_logs
  add constraint status_logs_from_status_check
  check (from_status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','ODLOZENO','OBJEDNANO','ZAMITNUTO'));

alter table public.status_logs drop constraint if exists status_logs_to_status_check;
alter table public.status_logs
  add constraint status_logs_to_status_check
  check (to_status in ('NOVA','V_JEDNANI','ODESLANA','NEREAGUJE','ODLOZENO','OBJEDNANO','ZAMITNUTO'));

-- 3) Datum připomenutí odložené poptávky
alter table public.inquiries add column if not exists remind_at date;
create index if not exists inquiries_remind_at_idx on public.inquiries (remind_at);
