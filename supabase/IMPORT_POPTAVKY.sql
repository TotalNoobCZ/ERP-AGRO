-- ============================================================================
--  IMPORT_POPTAVKY.sql — jednorázový import poptávek ze staré appky Popt-vky.
--  Zachovává čísla (#70–#95), odduplikuje zákazníky podle názvu, uloží kontakty,
--  historii stavů i poznámky. Odpovědné osoby se párují podle jména na profily.
--  IDEMPOTENTNÍ – lze spustit opakovaně (poptávky se párují podle čísla).
--  Supabase → SQL Editor → vložit → Run.
-- ============================================================================
begin;

create temp table _imp_cust (old_id text, name text, email text, phone text, address text, country text, cname text, cphone text, cemail text) on commit drop;
insert into _imp_cust values
  ('cmra6giby000112ljyusbe4o8','WASTECH a.s.','pilík@wastech.cz','602769439','Lazarská 11/6, 120 00 Praha2-Nové Město',NULL,NULL,NULL,NULL),
  ('cmrj667uk000hmc7h1j7or0sg','Bartoň s.r.o',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
  ('cmrj682ih000nmc7hi27fb8sj','DUOK',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
  ('cmrj6algk000tmc7hs4smwzxg','Diakonie Broumov',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
  ('cmrj6c14m000zmc7hn7xx9uq2','Melkov-WH',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
  ('cmrkc04tk0000rhhs6hfacwby','Qlar Czech s.r.o.',NULL,'+420','Průmyslová 484 Hala DC3, 252 61 Jeneč','Česko','Petr Rohlena','775409049','p.rohlena@qlar.com'),
  ('cmroid3r70001cyditcz8y1f4','SULTRADE','sultrade@sultrade.cz','724085054',NULL,NULL,NULL,NULL,NULL),
  ('cmrowelzi0001elvsnnr0if27','PastedGraphic  (Bartoň)',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
  ('cust_0001','LOGCITY','panek@logcity.cz','608456608',NULL,NULL,NULL,NULL,NULL),
  ('cust_0002','Alejas Projekti SIA','valdis@greenurban.Iv','27034977',NULL,NULL,NULL,NULL,NULL),
  ('cust_0003','Ethanol Energy a.s.','miroslav.kopecky@ethanolenergy.cz','601583991',NULL,NULL,NULL,NULL,NULL),
  ('cust_0004','Qlar','t.ludvikova@qlar.com','774164694',NULL,NULL,NULL,NULL,NULL),
  ('cust_0005','AgroCS Slovakia',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
  ('cust_0006','SKC foundry s.r.o.','bturekova@skc-foundry.com','917994345',NULL,'Slovensko',NULL,NULL,NULL),
  ('cust_0007','BMT Medical Technology s.r.o.(KOSOVO)',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
  ('cust_0008','Fungi Weld','bronis.tomas@gmail.com','951238129',NULL,NULL,NULL,NULL,NULL),
  ('cust_0009','BEUMER Group','pavel.vladyka@beumer.com','737179100',NULL,NULL,NULL,NULL,NULL),
  ('cust_0010','ELEKTRO Martínek .CZ','martinek@elektromartinek.cz',NULL,NULL,NULL,NULL,NULL,NULL),
  ('cust_0011','COREX CZECH s.r.o.','petr.volejnik@corexgroup.cz','606706207',NULL,NULL,NULL,NULL,NULL),
  ('cust_0012','Elkoplast Slovakia s.r.o.','tomas.slotik@elkoplast.sk','917957023',NULL,NULL,NULL,NULL,NULL),
  ('cust_0013','BRIKLIS s.r.o.','ales.svatek@briklis.cz','606669525',NULL,NULL,NULL,NULL,NULL),
  ('cust_0014','AGROTECHNIKA Vaněk s.r.o.','jaroslav.cerny@agrotechnika.cz','602340338',NULL,NULL,NULL,NULL,NULL),
  ('cust_0015','INNONIX','matyas.2.medve@gmail.com','903273477',NULL,NULL,NULL,NULL,NULL),
  ('cust_0016','Zelen-Služby,kom.spol.','misa.trojan16@gmail.com','775076872',NULL,NULL,NULL,NULL,NULL),
  ('cust_0017','Slovetra','Zidek@slovetra.sk','903620865',NULL,NULL,NULL,NULL,NULL),
  ('cust_0018','Bezos',NULL,NULL,NULL,NULL,NULL,NULL,NULL);

create temp table _imp_inq (old_id text, number bigint, received_at text, subject text, description text, status text, deadline text, old_customer_id text, person_key text, source text, cname text, cphone text, cemail text) on commit drop;
insert into _imp_inq values
  ('cmra6gihm000312ljl2xu1t16',89,'2026-07-07 00:00:00','Drtič','drtící linka na drcení dekontaminovaného zdravotnického odpadu a směsných odpadů.','ODESLANA','2026-08-05 00:00:00','cmra6giby000112ljyusbe4o8','person_jelinek',NULL,NULL,NULL,NULL),
  ('cmrj667zu000jmc7h7z9flnic',90,'2026-07-13 00:00:00','Drtič','Drcení brusného papíru','NOVA','2026-07-17 00:00:00','cmrj667uk000hmc7h1j7or0sg','person_jelinek','Přímé oslovení',NULL,NULL,NULL),
  ('cmrj682nm000pmc7h320sorhp',91,'2026-07-13 00:00:00','Drtič','SDS 560 Drum, SDS 850 Drum, SDS 1000 Drum','NOVA','2026-07-24 00:00:00','cmrj682ih000nmc7hi27fb8sj','person_jelinek','Mail',NULL,NULL,NULL),
  ('cmrj6allu000vmc7hlhflic5s',92,'2026-07-13 00:00:00','Drtič','Jedno hřídelový','ODESLANA','2026-07-17 00:00:00','cmrj6algk000tmc7hs4smwzxg','person_kadanik','Přímé oslovení',NULL,NULL,NULL),
  ('cmrj6c19s0011mc7hsf5vv1x1',93,'2026-07-13 00:00:00','DP','4x na kamenivo do cementárny Radotín','ODESLANA','2026-07-14 00:00:00','cmrj6c14m000zmc7hn7xx9uq2','person_vobornik','Mail','123','1234','12345'),
  ('cmroid3wq0003cydixu47hpg5',94,'2026-07-17 00:00:00','dopravní pás','dopravní pás s detektorem kovů, vyhazovací klapka , tenzo váhy. Vše s lokálním ovládáním.
Dopravník-816 209 typ PK -450','NOVA',NULL,'cmroid3r70001cyditcz8y1f4','person_jedlicka','Mail','Jan Sýkora','724085054','sultrade@sultrade.cz'),
  ('cmrowem520003elvsiez3gonh',95,'2026-07-17 00:00:00','Linka na drcení a mletí brusných papírů','Projekt: Technologie pro materiálové využití odpadů a výrobu stavebních prvků 

Popis: Nabízíme konstrukční zpracování, výrobu, dodání a uvedení do provozu automatizované technologické linky určené pro výrobu stavebních prvků z upravených odpadních, recyklovaných a druhotných surovin. Technologie zajišťuje příjem vstupního materiálu, jeho dávkování, homogenizaci s pojivovým systémem a následné tvarování a lisování do požadovaných rozměrů. Výrobní proces je navržen pro dosažení stabilních výrobních parametrů, vysoké produktivity a efektivního využití vstupních materiálů. Linka umožňuje výrobu obrubníků, dlažeb, stavebních bloků, zdicích prvků a dalších výrobků používaných ve stavebnictví a krajinářských aplikacích. Součástí základní dodávky je forma pro výrobu: • dlažebních prvků 200 × 100 × 60 mm Na základě požadavků zákazníka lze dodat další formy pro výrobu stavebních a krajinářských prvků různých tvarů a rozměrů. Technologie je navržena jako modulární systém umožňující doplnění o navazující zařízení pro manipulaci s materiálem, transport výrobků, automatické zakládání, stohování nebo robotizaci výrobního procesu. Základní konfigurace linky je počítána pro množství textilního odpadu v ročním množství cca 120t. Umožňuje výrobu cca 2 400 kusů výrobků během osmihodinové směny při zpracování přibližně 12 m³ vstupního materiálu (960kg). Měsíční množství odpadu 10t se zpracuje při osmihodinových směnách za přibližně 10 dnů. Instalovaný příkon základní konfigurace nepřesahuje 40 kW. Technologie je určena pro provoz v průmyslových a recyklačních provozech. Skutečný výkon zařízení závisí na typu vyráběného produktu, vlastnostech vstupní suroviny a konfiguraci technologie. 

Vstupní surovina: Technologie je navržena pro zpracování vhodných druhů recyklovaných a druhotných surovin. Kvalita a vlastnosti výsledných výrobků jsou ovlivněny složením vstupního materiálu a použitou výrobní recepturou.','NOVA',NULL,'cmrowelzi0001elvsnnr0if27','person_jelinek',NULL,'Radim Zdimal',NULL,'rzdimal@barton-textil.cz'),
  ('inq_0070',70,'2026-05-13 00:00:00','drtič','Kontakt: Zdeněk Pánek, panek@logcity.cz, tel. 608456608
Drcení palet','V_JEDNANI','2026-07-24 00:00:00','cust_0001','person_jelinek',NULL,NULL,NULL,NULL),
  ('inq_0071',71,'2026-05-14 00:00:00','MB','Kontakt: Valdis Turkovs, valdis@greenurban.Iv, tel. 27034977','ODESLANA',NULL,'cust_0002','person_kadanik',NULL,NULL,NULL,NULL),
  ('inq_0072',72,'2026-05-20 00:00:00','PH',NULL,'ZAMITNUTO',NULL,'cust_0003','person_kadanik',NULL,NULL,NULL,NULL),
  ('inq_0073',73,'2026-05-21 00:00:00','Hv. Síto','Kontakt: Ing.Táňa Ludvíková, t.ludvikova@qlar.com, tel. 774164694','ODESLANA',NULL,'cust_0004','person_jedlicka',NULL,NULL,NULL,NULL),
  ('inq_0074',74,'2026-05-26 00:00:00','plnění střeš.substr.','2027 / 2028','ODESLANA','2026-08-31 00:00:00','cust_0005','person_vobornik',NULL,NULL,NULL,NULL),
  ('inq_0075',75,'2026-05-26 00:00:00','HE-C',NULL,'ZAMITNUTO',NULL,'cust_0006','person_kadanik',NULL,NULL,NULL,NULL),
  ('inq_0076',76,'2026-05-28 00:00:00','H.síto','Kontakt: Ing.Jaroslav Brabec, J.Brabec@qlar.com, tel. 778748701','ODESLANA',NULL,'cust_0004','person_jedlicka',NULL,NULL,NULL,NULL),
  ('inq_0077',77,'2026-05-29 00:00:00','DRTIč  360+650','Kontakt: Miroslav Musil Dipl.Ing.
čeká se na rozhodnutí','ODESLANA',NULL,'cust_0007','person_jelinek',NULL,NULL,NULL,NULL),
  ('inq_0078',78,'2026-06-02 00:00:00','DŠ','Kontakt: Tomáš Broniš, bronis.tomas@gmail.com, tel. 951238129','NOVA','2026-07-31 00:00:00','cust_0008','person_vobornik',NULL,NULL,NULL,NULL),
  ('inq_0079',79,'2026-06-02 00:00:00','HS','Kontakt: Ing.Pavel Vladyka, pavel.vladyka@beumer.com, tel. 737179100','ODESLANA',NULL,'cust_0009','person_jedlicka',NULL,NULL,NULL,NULL),
  ('inq_0080',80,'2026-06-08 00:00:00','Drtič','Kontakt: Luboš Martínek, martinek@elektromartinek.cz
Potřeba více informací','ZAMITNUTO',NULL,'cust_0010','person_jelinek',NULL,NULL,NULL,NULL),
  ('inq_0081',81,'2026-06-11 00:00:00','zpracování pap. Dutinek','Kontakt: Petr Volejník, petr.volejnik@corexgroup.cz, tel. 606706207
Čekáme na vzorek dutinek','V_JEDNANI','2026-08-31 00:00:00','cust_0011','person_jelinek',NULL,NULL,NULL,NULL),
  ('inq_0082',82,'2026-06-11 00:00:00','drtič','Kontakt: Ing.Tomáš Slotík, tomas.slotik@elkoplast.sk, tel. 917957023
čekáme na upřesnění','NEREAGUJE',NULL,'cust_0012','person_jelinek',NULL,NULL,NULL,NULL),
  ('inq_0083',83,'2026-06-17 00:00:00','drtič','Kontakt: Aleš Svátek, ales.svatek@briklis.cz, tel. 606669525
Dají vědět','ODESLANA',NULL,'cust_0013','person_jelinek',NULL,NULL,NULL,NULL),
  ('inq_0084',84,'2026-06-29 00:00:00','Separátor-suť','Kontakt: Jaroslav Černý, jaroslav.cerny@agrotechnika.cz, tel. 602340338','NOVA',NULL,'cust_0014','person_jedlicka',NULL,NULL,NULL,NULL),
  ('inq_0085',85,'2026-06-29 00:00:00','H.síto','Kontakt: Matthias Medve, matyas.2.medve@gmail.com, tel. 903273477','NOVA',NULL,'cust_0015','person_jedlicka',NULL,NULL,NULL,NULL),
  ('inq_0086',86,'2026-06-29 00:00:00','MB','Kontakt: Michal Trojan, misa.trojan16@gmail.com, tel. 775076872','NOVA','2026-07-13 00:00:00','cust_0016','person_vobornik',NULL,NULL,NULL,NULL),
  ('inq_0087',87,'2026-06-29 00:00:00','BTS','Kontakt: B rano Zidek, Zidek@slovetra.sk, tel. 903620865','NOVA','2026-07-31 00:00:00','cust_0017','person_vobornik',NULL,NULL,NULL,NULL),
  ('inq_0088',88,'2026-06-29 00:00:00','3x DŠ',NULL,'NOVA','2026-07-31 00:00:00','cust_0018','person_vobornik',NULL,NULL,NULL,NULL);

create temp table _imp_sl (from_status text, to_status text, changed_by text, created_at text, old_inquiry_id text, note text) on commit drop;
insert into _imp_sl values
  (NULL,'NOVA','Petra Melšová','2026-07-07 04:57:23.301','cmra6gihm000312ljl2xu1t16',NULL),
  ('V_JEDNANI','ODESLANA','MELŠOVÁ Petra','2026-07-07 10:55:46.922','inq_0082',NULL),
  ('NOVA','ODESLANA','HARANT Kryštof','2026-07-13 11:42:53.193','cmra6gihm000312ljl2xu1t16',NULL),
  ('NEREAGUJE','ZAMITNUTO','HARANT Kryštof','2026-07-13 11:51:24.592','inq_0080',NULL),
  (NULL,'NOVA','HARANT Kryštof','2026-07-13 11:59:18.713','cmrj667zu000jmc7h7z9flnic',NULL),
  (NULL,'NOVA','HARANT Kryštof','2026-07-13 12:00:45.1','cmrj682nm000pmc7h320sorhp',NULL),
  (NULL,'NOVA','HARANT Kryštof','2026-07-13 12:02:42.976','cmrj6allu000vmc7hlhflic5s',NULL),
  (NULL,'NOVA','HARANT Kryštof','2026-07-13 12:03:49.93','cmrj6c19s0011mc7hsf5vv1x1',NULL),
  ('ODESLANA','ZAMITNUTO','HARANT Kryštof','2026-07-14 07:01:09.05','inq_0075',NULL),
  ('ZAMITNUTO','V_JEDNANI','HARANT Kryštof','2026-07-14 07:37:06.055','inq_0075',NULL),
  ('V_JEDNANI','ZAMITNUTO','HARANT Kryštof','2026-07-14 07:37:24.947','inq_0075','Vysoká cena oproti konkurenci'),
  ('ODESLANA','ZAMITNUTO','HARANT Kryštof','2026-07-14 08:08:58.687','inq_0072','Vybrán jiný zákazník na základě vysoké ceny'),
  ('ODESLANA','V_JEDNANI','MELŠOVÁ Petra','2026-07-14 11:27:54.621','inq_0071',NULL),
  ('V_JEDNANI','ODESLANA','HARANT Kryštof','2026-07-15 09:05:23.788','inq_0071',NULL),
  (NULL,'NOVA','MELŠOVÁ Petra','2026-07-17 05:39:26.289','cmroid3wq0003cydixu47hpg5',NULL),
  (NULL,'NOVA','MELŠOVÁ Petra','2026-07-17 12:12:31.205','cmrowem520003elvsiez3gonh',NULL),
  ('NOVA','ODESLANA','KADANÍK Emil','2026-07-20 11:35:14.275','cmrj6allu000vmc7hlhflic5s',NULL),
  ('ODESLANA','NEREAGUJE','HARANT Kryštof','2026-07-20 11:43:24.692','inq_0082',NULL),
  ('NOVA','ODESLANA','VOBORNÍK Jaroslav','2026-07-20 11:47:14.847','cmrj6c19s0011mc7hsf5vv1x1',NULL);

create temp table _imp_cm (text text, author text, created_at text, old_inquiry_id text) on commit drop;
insert into _imp_cm values
  ('Osobní návštěva 9.7.2026','HARANT Kryštof','2026-07-07 10:36:39.614','inq_0088'),
  ('Osobní návštěva 9.7.2026','MELŠOVÁ Petra','2026-07-07 10:37:20.272','inq_0088'),
  ('Nabídka na novou plničku (kopie stávající), další nabídka na obdobnou ale nemusí být z nerezu, 10 beden 1m3 kapacita s profukovacím dnem (otočné)','HARANT Kryštof','2026-07-13 11:40:57.243','inq_0087'),
  ('Přidat magnetické separátory a udělat nový layout','HARANT Kryštof','2026-07-13 11:43:44.458','cmra6gihm000312ljl2xu1t16'),
  ('Čekáme na vyjádření (objednání)','HARANT Kryštof','2026-07-13 11:49:04.859','inq_0083'),
  ('Je třeba další jednání','HARANT Kryštof','2026-07-13 11:50:07.113','inq_0081'),
  ('V jednání s bankou, čekáme na vyjádření','HARANT Kryštof','2026-07-13 11:53:27.933','inq_0077'),
  ('Layout','HARANT Kryštof','2026-07-13 11:54:56.08','inq_0074'),
  ('📞 Výsledek hovoru: Kontaktováno, zákazník neodpovídá','HARANT Kryštof','2026-07-14 06:52:32.125','inq_0075'),
  ('📞 Výsledek hovoru: Nabídka byla zamítnuta na základě vysoké ceny zařízení','HARANT Kryštof','2026-07-14 07:01:03.487','inq_0075'),
  ('📞 Výsledek hovoru: Status změněn','HARANT Kryštof','2026-07-14 08:09:17.393','inq_0072'),
  ('14.7. vyžádání upřesnění parametrů.','MELŠOVÁ Petra','2026-07-14 11:28:10.518','inq_0071');

create temp table _imp_ct (old_customer_id text, name text, phone text, email text, created_at text) on commit drop;
insert into _imp_ct values
  ('cmrkc04tk0000rhhs6hfacwby','Petr Rohlena','775409049','p.rohlena@qlar.com','2026-07-14 07:41:17.835');

-- 1) Zákazníci – vlož jen ty, kteří v systému ještě nejsou (shoda podle názvu).
insert into public.customers (name, email, phone, address, country, contact_name, contact_phone, contact_email)
select c.name, c.email, c.phone, c.address, c.country, c.cname, c.cphone, c.cemail
from _imp_cust c
where not exists (select 1 from public.customers x where lower(x.name) = lower(c.name));

-- Mapa: starý zákazník -> nové customer_id (podle názvu).
create temp table _map_cust (old_id text primary key, new_id uuid) on commit drop;
insert into _map_cust
select distinct on (c.old_id) c.old_id, x.id
from _imp_cust c join public.customers x on lower(x.name) = lower(c.name)
order by c.old_id, x.created_at;

-- Mapa odpovědných osob (person_key -> profil, párování podle příjmení).
create temp table _map_person (person_key text primary key, profile_id uuid) on commit drop;
insert into _map_person values
  ('person_jelinek',  (select id from public.profiles where name ilike '%jelínek%'  and active order by created_at limit 1)),
  ('person_kadanik',  (select id from public.profiles where name ilike '%kadaník%'  and active order by created_at limit 1)),
  ('person_vobornik', (select id from public.profiles where name ilike '%voborník%' and active order by created_at limit 1)),
  ('person_jedlicka', (select id from public.profiles where name ilike '%jedlička%' and active order by created_at limit 1));

-- 2) Poptávky – zachovej číslo; přeskoč, pokud číslo už existuje.
insert into public.inquiries
  (number, received_at, subject, description, status, deadline, customer_id, person_id,
   source, needs_contact, contact_name, contact_phone, contact_email, reminder_sent, expired_notified, created_at)
select i.number, i.received_at::timestamptz, i.subject, i.description, i.status, i.deadline::timestamptz,
       mc.new_id, mp.profile_id,
       i.source, false, i.cname, i.cphone, i.cemail, false, false, i.received_at::timestamptz
from _imp_inq i
join _map_cust mc on mc.old_id = i.old_customer_id
left join _map_person mp on mp.person_key = i.person_key
where not exists (select 1 from public.inquiries x where x.number = i.number);

-- Mapa: stará poptávka -> nové inquiry_id (podle čísla).
create temp table _map_inq (old_id text primary key, new_id uuid) on commit drop;
insert into _map_inq
select i.old_id, x.id from _imp_inq i join public.inquiries x on x.number = i.number;

-- 3) Historie stavů (bez duplicit při opakovaném běhu).
insert into public.status_logs (inquiry_id, from_status, to_status, changed_by, note, created_at)
select mi.new_id, sl.from_status, sl.to_status, sl.changed_by, sl.note, sl.created_at::timestamptz
from _imp_sl sl join _map_inq mi on mi.old_id = sl.old_inquiry_id
where not exists (
  select 1 from public.status_logs x
  where x.inquiry_id = mi.new_id and x.to_status = sl.to_status
    and x.changed_by = sl.changed_by and x.created_at = sl.created_at::timestamptz
);

-- 4) Poznámky / komentáře (bez duplicit).
insert into public.comments (inquiry_id, text, author, created_at)
select mi.new_id, cm.text, cm.author, cm.created_at::timestamptz
from _imp_cm cm join _map_inq mi on mi.old_id = cm.old_inquiry_id
where not exists (
  select 1 from public.comments x
  where x.inquiry_id = mi.new_id and x.text = cm.text and x.created_at = cm.created_at::timestamptz
);

-- 5a) Kontaktní osoby z tabulky Contact (napárováno na zákazníka).
insert into public.contacts (customer_id, name, phone, email, created_at)
select mc.new_id, ct.name, ct.phone, ct.email, ct.created_at::timestamptz
from _imp_ct ct join _map_cust mc on mc.old_id = ct.old_customer_id
where ct.name is not null
  and not exists (select 1 from public.contacts x where x.customer_id = mc.new_id and lower(x.name) = lower(ct.name));

-- 5b) Kontaktní osoby uvedené přímo na poptávce (na jejího zákazníka).
insert into public.contacts (customer_id, name, phone, email)
select distinct on (mc.new_id, lower(i.cname)) mc.new_id, i.cname, i.cphone, i.cemail
from _imp_inq i join _map_cust mc on mc.old_id = i.old_customer_id
where i.cname is not null
  and not exists (select 1 from public.contacts x where x.customer_id = mc.new_id and lower(x.name) = lower(i.cname));

-- 6) Posuň čítač čísel, ať se nové poptávky netrefí do importovaných.
select setval(pg_get_serial_sequence('public.inquiries','number'),
              greatest((select max(number) from public.inquiries), 1));

commit;
