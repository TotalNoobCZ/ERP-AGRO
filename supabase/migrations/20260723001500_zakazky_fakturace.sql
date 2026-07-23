-- ============================================================================
--  20260723001500_zakazky_fakturace.sql
--  Finále akce = fakturace a proplacení. Stav „Dokončeno" nahrazen stavem
--  „Fakturace" (po výrobě se řeší vystavení faktury); po zaplacení jde akce do
--  stavu „Proplaceno", který se bere jako hotové. Oba stavy má vlastní lišta
--  „Fakturace" (viz @erp/core ZAKAZKA_FAKTURACNI_STAVY).
--
--  Pořadí: nejdřív rozšířit check constraint (aby povolil nové stavy), teprve
--  pak přepsat existující DOKONCENO → FAKTURACE.
-- ============================================================================

alter table zakazky drop constraint if exists zakazky_stav_check;
alter table zakazky add constraint zakazky_stav_check
  check (stav in ('AKTIVNI', 'POZASTAVENO', 'FAKTURACE', 'PROPLACENO', 'ARCHIV'));

update zakazky set stav = 'FAKTURACE' where stav = 'DOKONCENO';
