-- ============================================================================
--  20260716000400_inquiry_person_optional.sql
--  Odpovědná osoba poptávky už není povinná při zakládání – lze ji doplnit
--  později (např. drag & drop na Tabuli poptávek).
-- ============================================================================
alter table inquiries alter column person_id drop not null;
