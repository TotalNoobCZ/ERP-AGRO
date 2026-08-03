-- ============================================================================
--  Smazání 7 zaseedovaných poptávek (vrácení seedu)
-- ----------------------------------------------------------------------------
--  Smaže přesně poptávky #96–#102 založené seedem. Historie stavu
--  (status_logs) i komentáře se smažou kaskádou automaticky.
--  Zákazníci a kontakty ZŮSTÁVAJÍ (můžeš je znovu použít při ručním zadání).
--
--  Klíč shody: předmět + zákazník + datum přijetí + kontaktní osoba
--  → smažou se jen tyto konkrétní řádky, nic jiného.
--
--  Postup:
--   1) Spusť nejdřív jen SELECT (náhled) a zkontroluj, že vidíš právě těch 7.
--   2) Pak spusť DELETE.
-- ============================================================================

-- Seznam seedovaných poptávek (subject, zákazník, datum, kontakt)
with cil as (
  select * from (values
    ('Drtič',                   'Plasma Chemical Technologies Department', date '2026-08-03', 'Jakub Pilař'),
    ('síto HS 80',              'TITAN',                                   date '2026-08-03', 'Ahmed Mansour'),
    ('hvězdicový separátor',    'Melkov-WH',                               date '2026-08-03', null),
    ('drtič -staré popt. č.62', 'Kamiddos',                                date '2026-04-30', 'Kamil Petík'),
    ('hvězdicové síto',         'Qlar Czech s.r.o.',                       date '2026-07-23', 'Petr Rohlena'),
    ('hvězdicový separátor',    'Qlar Czech s.r.o.',                       date '2026-07-23', 'Petr Rohlena'),
    ('hvězdicový separátor',    'Qlar Czech s.r.o.',                       date '2026-07-23', null)
  ) as t(subject, customer, received, contact)
)
-- 1) NÁHLED – zkontroluj, že vidíš právě těch 7 poptávek:
select i.number, i.subject, c.name as zakaznik, i.received_at::date, i.contact_name, i.status
from inquiries i
join customers c on c.id = i.customer_id
join cil on cil.subject = i.subject
        and cil.customer = c.name
        and cil.received = i.received_at::date
        and coalesce(cil.contact, '') = coalesce(i.contact_name, '')
order by i.number;

-- ----------------------------------------------------------------------------
-- 2) SMAZÁNÍ – spusť, až náhled sedí (status_logs/comments se smažou kaskádou):
-- ----------------------------------------------------------------------------
-- with cil as (
--   select * from (values
--     ('Drtič',                   'Plasma Chemical Technologies Department', date '2026-08-03', 'Jakub Pilař'),
--     ('síto HS 80',              'TITAN',                                   date '2026-08-03', 'Ahmed Mansour'),
--     ('hvězdicový separátor',    'Melkov-WH',                               date '2026-08-03', null),
--     ('drtič -staré popt. č.62', 'Kamiddos',                                date '2026-04-30', 'Kamil Petík'),
--     ('hvězdicové síto',         'Qlar Czech s.r.o.',                       date '2026-07-23', 'Petr Rohlena'),
--     ('hvězdicový separátor',    'Qlar Czech s.r.o.',                       date '2026-07-23', 'Petr Rohlena'),
--     ('hvězdicový separátor',    'Qlar Czech s.r.o.',                       date '2026-07-23', null)
--   ) as t(subject, customer, received, contact)
-- )
-- delete from inquiries i
-- using customers c, cil
-- where c.id = i.customer_id
--   and cil.subject  = i.subject
--   and cil.customer = c.name
--   and cil.received = i.received_at::date
--   and coalesce(cil.contact, '') = coalesce(i.contact_name, '');
