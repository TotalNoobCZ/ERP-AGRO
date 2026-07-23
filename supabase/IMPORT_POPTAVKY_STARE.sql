-- ============================================================================
--  IMPORT_POPTAVKY_STARE.sql — starší poptávky z PDF přehledu (N.o. 35–69).
--  Navazuje na IMPORT_POPTAVKY.sql (#70–#95). Zachovává čísla, odduplikuje
--  zákazníky podle názvu, ukládá kontakty, páruje odpovědné osoby dle jména.
--  IDEMPOTENTNÍ – poptávky se párují podle čísla.
-- ============================================================================
begin;

create temp table _imp (number bigint, subject text, cust_name text, cname text, cemail text, cphone text, received text, person_key text, deadline text, status text, note text) on commit drop;
insert into _imp values
  (35,'balící lis','Trans Stroj','Sergej Filimonov','s.filimonov@ts-arh.ru','79 642 946 777','2026-03-06','person_kadanik','2026-03-31','ZAMITNUTO',NULL),
  (36,'Míchání substrátu','SERELIA Ltd','George Minidis','geominidis@gmail.com',NULL,'2026-03-16','person_harant',NULL,'ODESLANA',NULL),
  (37,'Drtič SDS 1000,SDT2300,SQT1200','(neuvedeno)',NULL,'exotranoz@gmail.com',NULL,'2026-03-20','person_jelinek',NULL,'ODESLANA','Heňa'),
  (38,'separátor','Melkov - WH s.r.o.','Ing.Jan Studený','jan.studeny@melkov-wh.cz','601 329 875','2026-03-24','person_jedlicka',NULL,'ODESLANA',NULL),
  (39,'dopravník','Gurmány Zubří','Ing.Jiří Zeman','jiri.zeman@guzu.cz','731 596 674','2026-03-24','person_jedlicka',NULL,'ODESLANA',NULL),
  (40,'drtič','Diakonie Broumov','Ing.Pavel Hendrichovský','hendrichovsky@diakoniebroumov.org','603 581 902','2026-03-24','person_jelinek',NULL,'OBJEDNANO',NULL),
  (41,'drtič','Elektroodpady recyklace s.r.o.','Ing.Leoš Jiruška','jiruska@eore.cz','774 481 146','2026-03-24','person_jelinek',NULL,'V_JEDNANI','p. Kadaník volat do 3.7.'),
  (42,'drtič','SILON CZ s.r.o.','Petr Hnojna','hnojna@silon.eu','730 163 851','2026-03-24','person_jelinek',NULL,'V_JEDNANI','domluva testu drcení na Moravě'),
  (43,'dávkovací zásobník','JM COMPANY','Jan Navrátil','navratil@jmcompany.eu','775 955 315','2026-03-30','person_vobornik','2026-04-30','V_JEDNANI','Ozve se'),
  (44,'bal. BB','Mondeléz International','Matúš Čierny','Matus.Cierny@mdlz.com','917 564 454','2026-04-01','person_vobornik',NULL,'NEREAGUJE','Nabídka odeslána'),
  (45,'linka na třídění palet','Flexipal a.s.','Jan Hedbávný','jan.hedbavny@flexipal.com',NULL,'2026-04-07','person_kadanik',NULL,'ODESLANA','připraveno k expedici, čekáme na rozhodnutí'),
  (46,'drtiče','Diakonie Broumov (CLUTEX)','Ing.Pavel Hendrichovský','hendrichovsky@diakoniebroumov.org','603 581 902','2026-04-07','person_jelinek',NULL,'OBJEDNANO','Stejná jako nabídka 40.'),
  (47,'separátor','Veolia','Patrik Hellebrand','patrik.hellebrand@veolia.com','728 613 797','2026-04-09','person_jedlicka',NULL,'ODESLANA',NULL),
  (48,'separátor','Qlar','Mr.Igor Posvezhin','i.posvezhin@qlar.com','778 409 241','2026-04-09','person_jedlicka',NULL,'ODESLANA',NULL),
  (49,'drtiče','SOLLAU s.r.o.','Radek Mikel','mikel@csollau.cz','777 715 613','2026-04-09','person_jelinek',NULL,'ODESLANA','Prběhne test u nás'),
  (50,'ND na starscreen 811 161','Qlar',NULL,NULL,NULL,'2026-04-10','person_jedlicka',NULL,'ODESLANA',NULL),
  (51,'Dřevní vlákno','ABEX Žabeň',NULL,NULL,NULL,'2026-04-14','person_kadanik','2026-04-30','V_JEDNANI','Verze 3, aktualizovaná nabídka'),
  (52,'DP - doprava lignit','Duslo Šala',NULL,NULL,NULL,'2026-04-14','person_vobornik',NULL,'OBJEDNANO',NULL),
  (53,'předělání DOPPSTAT','JENA Praha','Ing. Švejkovský',NULL,NULL,'2026-04-14','person_vobornik','2026-04-30','OBJEDNANO','11-15.5. se ozve, přeobjednáno - 28.5. osobní schůzka'),
  (54,'SDS 560','ECOtech Innovation s.r.o.','Tomáš Moťka','motka@gesgroup.cz','739 808 883','2026-04-20','person_jelinek',NULL,'ODESLANA','Připraven'),
  (55,'síto','RPS Ostrava a.s.','Ing.Libor Man','libor.man@rpsostrava.cz','739 201 200','2026-04-21','person_jedlicka',NULL,'ODESLANA',NULL),
  (56,'roz. Klapka,příruba','PREOL','Lukáš Němec','Lukas.Nemec@preol.cz','724 391 288','2026-04-24','person_harant',NULL,'ZAMITNUTO',NULL),
  (57,'Míchárna substrátů','SERELIA Ltd','George Minidis','geominidis@gmail.com','306 974 494 946','2026-04-27','person_harant',NULL,'ODESLANA',NULL),
  (58,'Paletizace substrátů','SERELIA Ltd','George Minidis','geominidis@gmail.com','306 974 494 946','2026-04-27','person_harant',NULL,'ODESLANA',NULL),
  (59,'Míchání a balení substrátů','AgroCS Slovakia',NULL,NULL,NULL,'2026-04-27','person_kadanik',NULL,'ODESLANA','Výroba běží'),
  (60,'Metač hnojiv','LAT Nitrogen',NULL,NULL,NULL,'2026-04-27','person_harant',NULL,'ODESLANA','Akce na 2028'),
  (61,'Mobilní míchárna','AgroCS',NULL,NULL,NULL,'2026-04-27','person_jedlicka',NULL,'V_JEDNANI',NULL),
  (62,'drtič','KAMIDDOS','Kamil Petík','petik@kamiddos.cz','777 261 519','2026-04-30','person_jelinek',NULL,'V_JEDNANI','Čeká se na upřesnění'),
  (63,'MB (míchárna)','Landart s.r.o.','Richard Masar','info@landart.sk','902 922 454','2026-05-04','person_vobornik','2026-10-01','V_JEDNANI','Ozvou se později - 2027'),
  (64,'Vlek pro obsluhu dronů','AGRO CS Agroslužby','Kryštof Sahula',NULL,NULL,'2026-05-04','person_harant',NULL,'OBJEDNANO',NULL),
  (65,'3x dopravník cukrovar SK','Melkov - WH s.r.o.','Ing. Josef Velich',NULL,NULL,'2026-05-04','person_vobornik','2026-05-07','ZAMITNUTO','čekáme na odpověď'),
  (66,'Debigování - Kolín','Melkov - WH s.r.o.','Ing. Josef Velich',NULL,NULL,'2026-05-04','person_vobornik','2026-05-22','ZAMITNUTO',NULL),
  (67,'EL Duslo Šala','Duslo Šala','Ing. Volek',NULL,NULL,'2026-05-04','person_vobornik','2026-05-29','ODESLANA',NULL),
  (68,'VD','Satec','Ing. Klofát',NULL,NULL,'2026-05-04','person_harant',NULL,'OBJEDNANO',NULL),
  (69,'MB','Novarbo Oy','Petri Konttinen','petri.konttinen@novarbo.fi','358 407 058 160','2026-05-11','person_harant',NULL,'ODESLANA',NULL);

-- 1) Zákazníci – jen chybějící (shoda podle názvu).
insert into public.customers (name)
select distinct c.cust_name from _imp c
where not exists (select 1 from public.customers x where lower(x.name) = lower(c.cust_name));

create temp table _map_cust (cust_name text primary key, new_id uuid) on commit drop;
insert into _map_cust
select distinct on (lower(c.cust_name)) c.cust_name, x.id
from _imp c join public.customers x on lower(x.name) = lower(c.cust_name)
order by lower(c.cust_name), x.created_at;

-- Odpovědné osoby (párování podle příjmení; koho nenajde, nechá prázdné).
create temp table _map_person (person_key text primary key, profile_id uuid) on commit drop;
insert into _map_person values
  ('person_jelinek',  (select id from public.profiles where name ilike '%jelínek%'  and active order by created_at limit 1)),
  ('person_kadanik',  (select id from public.profiles where name ilike '%kadaník%'  and active order by created_at limit 1)),
  ('person_vobornik', (select id from public.profiles where name ilike '%voborník%' and active order by created_at limit 1)),
  ('person_jedlicka', (select id from public.profiles where name ilike '%jedlička%' and active order by created_at limit 1)),
  ('person_harant',   (select id from public.profiles where name ilike '%harant%'   and active order by created_at limit 1));

-- 2) Poptávky – zachovej číslo; přeskoč, pokud číslo už existuje.
insert into public.inquiries
  (number, received_at, subject, description, status, deadline, customer_id, person_id,
   needs_contact, contact_name, contact_phone, contact_email, reminder_sent, expired_notified, created_at)
select i.number, coalesce(i.received::timestamptz, now()), i.subject, i.note, i.status, i.deadline::timestamptz,
       mc.new_id, mp.profile_id,
       false, i.cname, i.cphone, i.cemail, false, false, coalesce(i.received::timestamptz, now())
from _imp i
join _map_cust mc on lower(mc.cust_name) = lower(i.cust_name)
left join _map_person mp on mp.person_key = i.person_key
where not exists (select 1 from public.inquiries x where x.number = i.number);

-- 3) Kontaktní osoby (na zákazníka; bez duplicit).
insert into public.contacts (customer_id, name, phone, email)
select distinct on (mc.new_id, lower(i.cname)) mc.new_id, i.cname, i.cphone, i.cemail
from _imp i join _map_cust mc on lower(mc.cust_name) = lower(i.cust_name)
where i.cname is not null
  and not exists (select 1 from public.contacts x where x.customer_id = mc.new_id and lower(x.name) = lower(i.cname));

-- 4) Posuň čítač čísel.
select setval(pg_get_serial_sequence('public.inquiries','number'),
              greatest((select max(number) from public.inquiries), 1));

commit;
