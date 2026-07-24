-- ============================================================================
--  20260724000100_zakazky_fakturace_od.sql
--  Sledování lhůty proplacení: kdy akce vstoupila do stavu „Fakturace".
--  Slouží k upozornění odpovědné osobě, když faktura není proplacena do 30 dní.
--  Nastavuje se při přechodu na FAKTURACE; při návratu do výroby se nuluje.
--  Backfill: u akcí, které už ve Fakturaci jsou, dosadíme čas poslední změny.
-- ============================================================================

alter table zakazky add column if not exists fakturace_od timestamptz;

update zakazky set fakturace_od = coalesce(updated_at, now())
  where stav = 'FAKTURACE' and fakturace_od is null;
