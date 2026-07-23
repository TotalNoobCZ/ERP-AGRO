-- ============================================================================
--  20260723001500_zakazky_fakturace.sql
--  Finále akce = fakturace a proplacení. Stav „Dokončeno" nahrazen stavem
--  „Fakturace" (po výrobě se řeší vystavení faktury); po zaplacení jde akce do
--  stavu „Proplaceno", který se bere jako hotové. Oba stavy má vlastní lišta
--  „Fakturace" (viz @erp/core ZAKAZKA_FAKTURACNI_STAVY).
-- ============================================================================

-- Existující dokončené akce přesuneme rovnou do fakturace.
update zakazky set stav = 'FAKTURACE' where stav = 'DOKONCENO';

-- Rozšíření povolených stavů (odebrání DOKONCENO, přidání FAKTURACE/PROPLACENO).
alter table zakazky drop constraint if exists zakazky_stav_check;
alter table zakazky add constraint zakazky_stav_check
  check (stav in ('AKTIVNI', 'POZASTAVENO', 'FAKTURACE', 'PROPLACENO', 'ARCHIV'));
