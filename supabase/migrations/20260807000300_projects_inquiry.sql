-- ============================================================================
--  20260807000300_projects_inquiry.sql
--  Konstrukční projekt může patřit i poptávce (tlačítko „Konstrukce" na
--  poptávce): projects.zakazka_id nově nullable + vazba inquiry_id.
--  Vždy musí být vyplněna právě jedna z vazeb (zakázka NEBO poptávka).
--  Po vzniku zakázky z poptávky se projekt přepojí na zakázku.
-- ============================================================================

alter table projects alter column zakazka_id drop not null;
alter table projects add column if not exists inquiry_id uuid references inquiries (id);

do $$ begin
  alter table projects add constraint projects_vazba_check
    check (zakazka_id is not null or inquiry_id is not null);
exception when duplicate_object then null; end $$;
