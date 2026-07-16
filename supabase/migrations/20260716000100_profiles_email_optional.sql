-- ============================================================================
--  20260716000100_profiles_email_optional.sql
--  E-mail už není povinný. Lidé z dílny se do systému nepřihlašují
--  (jen se přiřazují na zakázky/úkoly), takže e-mail nepotřebují.
--  Unikátní index na e-mail zůstává – Postgres více NULL hodnot nekoliduje.
-- ============================================================================
alter table profiles alter column email drop not null;
