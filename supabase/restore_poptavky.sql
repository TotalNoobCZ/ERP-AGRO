-- ============================================================================
--  OBNOVA POPTÁVEK z exportu (inquiries + status_logs + comments)
--  Zákazníci/kontakty se PÁRUJÍ podle jména (nemazaly se). Poptávky dostanou
--  deterministické id z původního id (md5), takže historie i komentáře
--  navazují správně. Čísla poptávek (#70–#102) se zachovají.
--  Spustit CELÉ najednou v Supabase → SQL editoru. Atomické (BEGIN/COMMIT).
-- ============================================================================
begin;

create temporary table stg_customers(
  id text, name text, email text, phone text, address text,
  created_at text, updated_at text, country text,
  contact_name text, contact_phone text, contact_email text
) on commit drop;
create temporary table stg_inquiries(
  id text, received_at text, subject text, description text, status text,
  deadline text, customer_id text, person_id text, source text, number text,
  contact_name text, contact_phone text, contact_email text,
  reminder_sent text, expired_notified text, needs_contact text,
  created_at text, updated_at text
) on commit drop;
create temporary table stg_contacts(
  id text, name text, phone text, email text, created_at text, customer_id text
) on commit drop;
create temporary table stg_status(
  id text, from_status text, to_status text, changed_by text,
  created_at text, inquiry_id text, note text
) on commit drop;
create temporary table stg_comments(
  id text, text text, author text, created_at text, inquiry_id text
) on commit drop;

insert into stg_customers(id,name,email,phone,address,created_at,updated_at,country,contact_name,contact_phone,contact_email) values
('cmra6giby000112ljyusbe4o8','WASTECH a.s.','pilík@wastech.cz','602769439','Lazarská 11/6, 120 00 Praha2-Nové Město','2026-07-07 04:57:22.895','2026-07-07 04:57:22.895',NULL,NULL,NULL,NULL),
('cmrj667uk000hmc7h1j7or0sg','Bartoň s.r.o',NULL,NULL,NULL,'2026-07-13 11:59:18.333','2026-07-13 11:59:18.333',NULL,NULL,NULL,NULL),
('cmrj682ih000nmc7hi27fb8sj','DUOK',NULL,NULL,NULL,'2026-07-13 12:00:44.729','2026-07-13 12:00:44.729',NULL,NULL,NULL,NULL),
('cmrj6algk000tmc7hs4smwzxg','Diakonie Broumov',NULL,NULL,NULL,'2026-07-13 12:02:42.596','2026-07-13 12:02:42.596',NULL,NULL,NULL,NULL),
('cmrj6c14m000zmc7hn7xx9uq2','Melkov-WH',NULL,NULL,NULL,'2026-07-13 12:03:49.559','2026-07-13 12:03:49.559',NULL,NULL,NULL,NULL),
('cmrkc04tk0000rhhs6hfacwby','Qlar Czech s.r.o.',NULL,'+420','Průmyslová 484 Hala DC3, 252 61 Jeneč','2026-07-14 07:30:18.341','2026-07-14 07:30:18.341','Česko','Petr Rohlena','775409049','p.rohlena@qlar.com'),
('cmroid3r70001cyditcz8y1f4','SULTRADE','sultrade@sultrade.cz','724085054',NULL,'2026-07-17 05:39:25.888','2026-07-17 05:39:25.888',NULL,NULL,NULL,NULL),
('cmrowelzi0001elvsnnr0if27','PastedGraphic  (Bartoň)',NULL,NULL,NULL,'2026-07-17 12:12:30.799','2026-07-17 12:12:30.799',NULL,NULL,NULL,NULL),
('cmscps5hv0001r0cm5hf0f4cj','Kamiddos','petik@kamiddos.cz','777261519',NULL,'2026-08-03 04:13:33.523','2026-08-03 04:13:33.523',NULL,NULL,NULL,NULL),
('cmsd3sf3a0001cmda0bvg4ykw','TITAN','titancementegypt.com','+20 120 090 8065',NULL,'2026-08-03 10:45:40.58','2026-08-03 10:45:40.58','Jiný',NULL,NULL,NULL),
('cmsd4bylj0001k07q13s9hqlw','Plasma Chemical Technologies Department',NULL,NULL,NULL,'2026-08-03 11:00:52.324','2026-08-03 11:00:52.324',NULL,NULL,NULL,NULL),
('cust_0001','LOGCITY','panek@logcity.cz','608456608',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0002','Alejas Projekti SIA','valdis@greenurban.Iv','27034977',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0003','Ethanol Energy a.s.','miroslav.kopecky@ethanolenergy.cz','601583991',NULL,'2026-07-01 04:51:57.059','2026-07-14 04:38:43.081',NULL,NULL,NULL,NULL),
('cust_0004','Qlar','t.ludvikova@qlar.com','774164694',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0005','AgroCS Slovakia',NULL,NULL,NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0006','SKC foundry s.r.o.','bturekova@skc-foundry.com','917994345',NULL,'2026-07-01 04:51:57.059','2026-07-14 07:10:05.504','Slovensko',NULL,NULL,NULL),
('cust_0007','BMT Medical Technology s.r.o.(KOSOVO)',NULL,NULL,NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0008','Fungi Weld','bronis.tomas@gmail.com','951238129',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0009','BEUMER Group','pavel.vladyka@beumer.com','737179100',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0010','ELEKTRO Martínek .CZ','martinek@elektromartinek.cz',NULL,NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0011','COREX CZECH s.r.o.','petr.volejnik@corexgroup.cz','606706207',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0012','Elkoplast Slovakia s.r.o.','tomas.slotik@elkoplast.sk','917957023',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0013','BRIKLIS s.r.o.','ales.svatek@briklis.cz','606669525',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0014','AGROTECHNIKA Vaněk s.r.o.','jaroslav.cerny@agrotechnika.cz','602340338',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0015','INNONIX','matyas.2.medve@gmail.com','903273477',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0016','Zelen-Služby,kom.spol.','misa.trojan16@gmail.com','775076872',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0017','Slovetra','Zidek@slovetra.sk','903620865',NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL),
('cust_0018','Bezos',NULL,NULL,NULL,'2026-07-01 04:51:57.059','2026-07-01 04:51:57.059',NULL,NULL,NULL,NULL);

insert into stg_contacts(id,name,phone,email,created_at,customer_id) values
('dca157f4-de31-423d-9ff3-641d448f6234','Petr Rohlena','775409049','p.rohlena@qlar.com','2026-07-14 07:41:17.835','cmrkc04tk0000rhhs6hfacwby');

insert into stg_inquiries(id,received_at,subject,description,status,deadline,customer_id,person_id,source,number,contact_name,contact_phone,contact_email,reminder_sent,expired_notified,needs_contact,created_at,updated_at) values
('cmra6gihm000312ljl2xu1t16','2026-07-07 00:00:00','Drtič','drtící linka na drcení dekontaminovaného zdravotnického odpadu a směsných odpadů.','ODESLANA','2026-08-05 00:00:00','cmra6giby000112ljyusbe4o8','person_jelinek',NULL,'89',NULL,NULL,NULL,'false','false','false','2026-07-07 04:57:23.099','2026-07-13 11:44:12.952'),
('cmrj667zu000jmc7h7z9flnic','2026-07-13 00:00:00','Drtič','Drcení brusného papíru','NOVA','2026-07-17 00:00:00','cmrj667uk000hmc7h1j7or0sg','person_jelinek','Přímé oslovení','90',NULL,NULL,NULL,'false','false','false','2026-07-13 11:59:18.523','2026-07-13 11:59:18.523'),
('cmrj682nm000pmc7h320sorhp','2026-07-13 00:00:00','Drtič','SDS 560 Drum, SDS 850 Drum, SDS 1000 Drum','NOVA','2026-07-24 00:00:00','cmrj682ih000nmc7hi27fb8sj','person_jelinek','Mail','91',NULL,NULL,NULL,'false','false','false','2026-07-13 12:00:44.914','2026-07-13 12:00:44.914'),
('cmrj6allu000vmc7hlhflic5s','2026-07-13 00:00:00','Drtič','Jedno hřídelový','ODESLANA','2026-07-17 00:00:00','cmrj6algk000tmc7hs4smwzxg','person_kadanik','Přímé oslovení','92',NULL,NULL,NULL,'false','false','false','2026-07-13 12:02:42.786','2026-07-20 11:35:14.275'),
('cmrj6c19s0011mc7hsf5vv1x1','2026-07-13 00:00:00','DP','4x na kamenivo do cementárny Radotín','OBJEDNANO','2026-07-14 00:00:00','cmrj6c14m000zmc7hn7xx9uq2','person_vobornik','Mail','93','123','1234','12345','false','false','false','2026-07-13 12:03:49.744','2026-08-03 09:22:23.437'),
('cmroid3wq0003cydixu47hpg5','2026-07-17 00:00:00','dopravní pás','dopravní pás s detektorem kovů, vyhazovací klapka , tenzo váhy. Vše s lokálním ovládáním.
Dopravník-816 209 typ PK -450','NOVA',NULL,'cmroid3r70001cyditcz8y1f4','person_jedlicka','Mail','94','Jan Sýkora','724085054','sultrade@sultrade.cz','false','false','false','2026-07-17 05:39:26.09','2026-07-17 05:39:26.09'),
('cmrowem520003elvsiez3gonh','2026-07-17 00:00:00','Linka na drcení a mletí brusných papírů','Projekt: Technologie pro materiálové využití odpadů a výrobu stavebních prvků 

Popis: Nabízíme konstrukční zpracování, výrobu, dodání a uvedení do provozu automatizované technologické linky určené pro výrobu stavebních prvků z upravených odpadních, recyklovaných a druhotných surovin. Technologie zajišťuje příjem vstupního materiálu, jeho dávkování, homogenizaci s pojivovým systémem a následné tvarování a lisování do požadovaných rozměrů. Výrobní proces je navržen pro dosažení stabilních výrobních parametrů, vysoké produktivity a efektivního využití vstupních materiálů. Linka umožňuje výrobu obrubníků, dlažeb, stavebních bloků, zdicích prvků a dalších výrobků používaných ve stavebnictví a krajinářských aplikacích. Součástí základní dodávky je forma pro výrobu: • dlažebních prvků 200 × 100 × 60 mm Na základě požadavků zákazníka lze dodat další formy pro výrobu stavebních a krajinářských prvků různých tvarů a rozměrů. Technologie je navržena jako modulární systém umožňující doplnění o navazující zařízení pro manipulaci s materiálem, transport výrobků, automatické zakládání, stohování nebo robotizaci výrobního procesu. Základní konfigurace linky je počítána pro množství textilního odpadu v ročním množství cca 120t. Umožňuje výrobu cca 2 400 kusů výrobků během osmihodinové směny při zpracování přibližně 12 m³ vstupního materiálu (960kg). Měsíční množství odpadu 10t se zpracuje při osmihodinových směnách za přibližně 10 dnů. Instalovaný příkon základní konfigurace nepřesahuje 40 kW. Technologie je určena pro provoz v průmyslových a recyklačních provozech. Skutečný výkon zařízení závisí na typu vyráběného produktu, vlastnostech vstupní suroviny a konfiguraci technologie. 

Vstupní surovina: Technologie je navržena pro zpracování vhodných druhů recyklovaných a druhotných surovin. Kvalita a vlastnosti výsledných výrobků jsou ovlivněny složením vstupního materiálu a použitou výrobní recepturou.','NOVA',NULL,'cmrowelzi0001elvsnnr0if27','person_jelinek',NULL,'95','Radim Zdimal',NULL,'rzdimal@barton-textil.cz','false','false','false','2026-07-17 12:12:30.999','2026-07-17 12:12:30.999'),
('cmrxfmjom0002cq7tzs7sx5et','2026-07-23 00:00:00','hvězdicový separátor',NULL,'ODESLANA',NULL,'cust_0004','person_jedlicka','Mail','96',NULL,NULL,NULL,'false','false','false','2026-07-23 11:32:43.175','2026-07-23 11:33:01.453'),
('cmrxfqho30009cq7tna1hwnt9','2026-07-23 00:00:00','hvězdicový separátor',NULL,'ODESLANA',NULL,'cmrkc04tk0000rhhs6hfacwby','person_jedlicka','Mail','97','Petr Rohlena','775409049','p.rohlena@qlar.com','false','false','false','2026-07-23 11:35:47.188','2026-07-23 11:36:04.625'),
('cmrxftesh000gcq7t1ay8w2zl','2026-07-23 00:00:00','hvězdicové síto',NULL,'ODESLANA',NULL,'cmrkc04tk0000rhhs6hfacwby','person_jedlicka','Mail','98','Petr Rohlena','775409049','p.rohlena@qlar.com','false','false','false','2026-07-23 11:38:03.426','2026-07-23 11:38:12.281'),
('cmscps5nh0003r0cmfeccdif7','2026-04-30 00:00:00','drtič	-staré popt. č.62',NULL,'ODESLANA',NULL,'cmscps5hv0001r0cm5hf0f4cj','person_jelinek',NULL,'99','Kamil Petík','777261519','petik@kamiddos.cz','false','false','false','2026-08-03 04:13:33.725','2026-08-03 04:14:03.034'),
('cmscw135m00024wzmjef1wvq8','2026-08-03 00:00:00','hvězdicový separátor',NULL,'ODESLANA',NULL,'cmrj6c14m000zmc7hn7xx9uq2','person_jedlicka','Mail','100',NULL,NULL,NULL,'false','false','false','2026-08-03 07:08:28.09','2026-08-03 07:08:39.233'),
('cmsd3sf8w0003cmdas9mf65gq','2026-08-03 00:00:00','síto HS 80','Již jedno mají','NOVA',NULL,'cmsd3sf3a0001cmda0bvg4ykw','person_jan_novak','Mail','101','Ahmed Mansour','+20 120 090 8065','Ahmed.Mansour@titan.com.eg','false','false','false','2026-08-03 10:45:40.784','2026-08-03 10:45:40.784'),
('cmsd4byqy0003k07qnpmkdeov','2026-08-03 00:00:00','Drtič',NULL,'NOVA',NULL,'cmsd4bylj0001k07q13s9hqlw','person_jan_novak','Mail','102','Jakub Pilař','266 052 078','pilar@ipp.cas.cz','false','false','false','2026-08-03 11:00:52.523','2026-08-03 11:00:52.523'),
('inq_0070','2026-05-13 00:00:00','drtič','Kontakt: Zdeněk Pánek, panek@logcity.cz, tel. 608456608
Drcení palet','V_JEDNANI','2026-07-24 00:00:00','cust_0001','person_jelinek',NULL,'70',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-13 11:57:17.856'),
('inq_0071','2026-05-14 00:00:00','MB','Kontakt: Valdis Turkovs, valdis@greenurban.Iv, tel. 27034977','ODESLANA',NULL,'cust_0002','person_kadanik',NULL,'71',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-15 09:05:23.788'),
('inq_0072','2026-05-20 00:00:00','PH',NULL,'ZAMITNUTO',NULL,'cust_0003','person_kadanik',NULL,'72',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-14 08:09:17.393'),
('inq_0073','2026-05-21 00:00:00','Hv. Síto','Kontakt: Ing.Táňa Ludvíková, t.ludvikova@qlar.com, tel. 774164694','ODESLANA',NULL,'cust_0004','person_jedlicka',NULL,'73',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-01 04:51:57.059'),
('inq_0074','2026-05-26 00:00:00','plnění střeš.substr.','2027 / 2028','ODESLANA','2026-08-31 00:00:00','cust_0005','person_vobornik',NULL,'74',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-13 11:54:45.367'),
('inq_0075','2026-05-26 00:00:00','HE-C',NULL,'ZAMITNUTO',NULL,'cust_0006','person_kadanik',NULL,'75',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-14 07:37:24.947'),
('inq_0076','2026-05-28 00:00:00','H.síto','Kontakt: Ing.Jaroslav Brabec, J.Brabec@qlar.com, tel. 778748701','ODESLANA',NULL,'cust_0004','person_jedlicka',NULL,'76',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-01 04:51:57.059'),
('inq_0077','2026-05-29 00:00:00','DRTIč  360+650','Kontakt: Miroslav Musil Dipl.Ing.
čeká se na rozhodnutí','ODESLANA',NULL,'cust_0007','person_jelinek',NULL,'77',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-01 04:51:57.059'),
('inq_0078','2026-06-02 00:00:00','DŠ','Kontakt: Tomáš Broniš, bronis.tomas@gmail.com, tel. 951238129','NOVA','2026-07-31 00:00:00','cust_0008','person_vobornik',NULL,'78',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-13 11:52:02.691'),
('inq_0079','2026-06-02 00:00:00','HS','Kontakt: Ing.Pavel Vladyka, pavel.vladyka@beumer.com, tel. 737179100','ODESLANA',NULL,'cust_0009','person_jedlicka',NULL,'79',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-01 04:51:57.059'),
('inq_0080','2026-06-08 00:00:00','Drtič','Kontakt: Luboš Martínek, martinek@elektromartinek.cz
Potřeba více informací','ZAMITNUTO',NULL,'cust_0010','person_jelinek',NULL,'80',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-13 11:51:24.592'),
('inq_0081','2026-06-11 00:00:00','zpracování pap. Dutinek','Kontakt: Petr Volejník, petr.volejnik@corexgroup.cz, tel. 606706207
Čekáme na vzorek dutinek','V_JEDNANI','2026-08-31 00:00:00','cust_0011','person_jelinek',NULL,'81',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-13 11:50:37.466'),
('inq_0082','2026-06-11 00:00:00','drtič','Kontakt: Ing.Tomáš Slotík, tomas.slotik@elkoplast.sk, tel. 917957023
čekáme na upřesnění','NEREAGUJE',NULL,'cust_0012','person_jelinek',NULL,'82',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-20 11:43:24.692'),
('inq_0083','2026-06-17 00:00:00','drtič','Kontakt: Aleš Svátek, ales.svatek@briklis.cz, tel. 606669525
Dají vědět','ODESLANA',NULL,'cust_0013','person_jelinek',NULL,'83',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-01 04:51:57.059'),
('inq_0084','2026-06-29 00:00:00','Separátor-suť','Kontakt: Jaroslav Černý, jaroslav.cerny@agrotechnika.cz, tel. 602340338','NOVA',NULL,'cust_0014','person_jedlicka',NULL,'84',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-01 04:51:57.059'),
('inq_0085','2026-06-29 00:00:00','H.síto','Kontakt: Matthias Medve, matyas.2.medve@gmail.com, tel. 903273477','NOVA',NULL,'cust_0015','person_jedlicka',NULL,'85',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-01 04:51:57.059'),
('inq_0086','2026-06-29 00:00:00','MB','Kontakt: Michal Trojan, misa.trojan16@gmail.com, tel. 775076872','NOVA','2026-07-13 00:00:00','cust_0016','person_vobornik',NULL,'86',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-01 04:51:57.059'),
('inq_0087','2026-06-29 00:00:00','BTS','Kontakt: B rano Zidek, Zidek@slovetra.sk, tel. 903620865','NOVA','2026-07-31 00:00:00','cust_0017','person_vobornik',NULL,'87',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-13 11:41:27.489'),
('inq_0088','2026-06-29 00:00:00','3x DŠ',NULL,'NOVA','2026-07-31 00:00:00','cust_0018','person_vobornik',NULL,'88',NULL,NULL,NULL,'false','false','false','2026-07-01 04:51:57.059','2026-07-13 11:47:48.781');

insert into stg_status(id,from_status,to_status,changed_by,created_at,inquiry_id,note) values
('cmra6gin8000512ljik51xvwg',NULL,'NOVA','Petra Melšová','2026-07-07 04:57:23.301','cmra6gihm000312ljl2xu1t16',NULL),
('cmraj9f350001b310xho6m0de','V_JEDNANI','ODESLANA','MELŠOVÁ Petra','2026-07-07 10:55:46.922','inq_0082',NULL),
('cmrj5l3uq0003mc7hmz6tn3na','NOVA','ODESLANA','HARANT Kryštof','2026-07-13 11:42:53.193','cmra6gihm000312ljl2xu1t16',NULL),
('cmrj5w2g7000bmc7h5e6xq6g4','NEREAGUJE','ZAMITNUTO','HARANT Kryštof','2026-07-13 11:51:24.592','inq_0080',NULL),
('cmrj66854000lmc7hmfidxqt9',NULL,'NOVA','HARANT Kryštof','2026-07-13 11:59:18.713','cmrj667zu000jmc7h7z9flnic',NULL),
('cmrj682ss000rmc7had9q5o4w',NULL,'NOVA','HARANT Kryštof','2026-07-13 12:00:45.1','cmrj682nm000pmc7h320sorhp',NULL),
('cmrj6alr3000xmc7hngsfscnc',NULL,'NOVA','HARANT Kryštof','2026-07-13 12:02:42.976','cmrj6allu000vmc7hlhflic5s',NULL),
('cmrj6c1ex0013mc7h8b9us4pr',NULL,'NOVA','HARANT Kryštof','2026-07-13 12:03:49.93','cmrj6c19s0011mc7hsf5vv1x1',NULL),
('cmrkayn7600038zj6oeqec6m6','ODESLANA','ZAMITNUTO','HARANT Kryštof','2026-07-14 07:01:09.05','inq_0075',NULL),
('cmrkc8vjz0001jc5f1fxlnd79','ZAMITNUTO','V_JEDNANI','HARANT Kryštof','2026-07-14 07:37:06.055','inq_0075',NULL),
('cmrkc9a4r0003jc5ftcx5dif3','V_JEDNANI','ZAMITNUTO','HARANT Kryštof','2026-07-14 07:37:24.947','inq_0075','Vysoká cena oproti konkurenci'),
('cmrkddvco00012hbbgx8e49tr','ODESLANA','ZAMITNUTO','HARANT Kryštof','2026-07-14 08:08:58.687','inq_0072','Vybrán jiný zákazník na základě vysoké ceny'),
('cmrkkhp6c0001f0qqlon5dspj','ODESLANA','V_JEDNANI','MELŠOVÁ Petra','2026-07-14 11:27:54.621','inq_0071',NULL),
('cmrluu9z60001txgxrhni4b3m','V_JEDNANI','ODESLANA','HARANT Kryštof','2026-07-15 09:05:23.788','inq_0071',NULL),
('cmroid4290005cydioys6cn7x',NULL,'NOVA','MELŠOVÁ Petra','2026-07-17 05:39:26.289','cmroid3wq0003cydixu47hpg5',NULL),
('cmrowemas0005elvsb8aiyqsi',NULL,'NOVA','MELŠOVÁ Petra','2026-07-17 12:12:31.205','cmrowem520003elvsiez3gonh',NULL),
('cmrt5e8ey0001nb4vaxu4jjku','NOVA','ODESLANA','KADANÍK Emil','2026-07-20 11:35:14.275','cmrj6allu000vmc7hlhflic5s',NULL),
('cmrt5oqtp0003nb4v7oui6zj5','ODESLANA','NEREAGUJE','HARANT Kryštof','2026-07-20 11:43:24.692','inq_0082',NULL),
('cmrt5toey0005nb4vvd5hbiwa','NOVA','ODESLANA','VOBORNÍK Jaroslav','2026-07-20 11:47:14.847','cmrj6c19s0011mc7hsf5vv1x1',NULL),
('cmrxfmjuh0004cq7t1v9d1dar',NULL,'NOVA','MELŠOVÁ Petra','2026-07-23 11:32:43.385','cmrxfmjom0002cq7tzs7sx5et',NULL),
('cmrxfmxxm0006cq7ttmrl9cka','NOVA','ODESLANA','HARANT Kryštof','2026-07-23 11:33:01.453','cmrxfmjom0002cq7tzs7sx5et',NULL),
('cmrxfqhtm000bcq7thcbnk9kv',NULL,'NOVA','MELŠOVÁ Petra','2026-07-23 11:35:47.386','cmrxfqho30009cq7tna1hwnt9',NULL),
('cmrxfqv9q000dcq7t6pc3u986','NOVA','ODESLANA','HARANT Kryštof','2026-07-23 11:36:04.625','cmrxfqho30009cq7tna1hwnt9',NULL),
('cmrxftexw000icq7tz0jbkrvs',NULL,'NOVA','MELŠOVÁ Petra','2026-07-23 11:38:03.62','cmrxftesh000gcq7t1ay8w2zl',NULL),
('cmrxftlrq000kcq7t5wy5qxpy','NOVA','ODESLANA','HARANT Kryštof','2026-07-23 11:38:12.281','cmrxftesh000gcq7t1ay8w2zl',NULL),
('cmscps5t50005r0cm5fydlhuf',NULL,'NOVA','MELŠOVÁ Petra','2026-08-03 04:13:33.93','cmscps5nh0003r0cmfeccdif7',NULL),
('cmscpsset0007r0cmtixznv3p','NOVA','ODESLANA','HARANT Kryštof','2026-08-03 04:14:03.034','cmscps5nh0003r0cmfeccdif7',NULL),
('cmscw13b600044wzmdzr057yr',NULL,'NOVA','MELŠOVÁ Petra','2026-08-03 07:08:28.291','cmscw135m00024wzmjef1wvq8',NULL),
('cmscw1bwc00064wzm9hbd5gtp','NOVA','ODESLANA','HARANT Kryštof','2026-08-03 07:08:39.233','cmscw135m00024wzmjef1wvq8',NULL),
('cmsd0tbeu0001s1x9cxxemayo','ODESLANA','OBJEDNANO','HARANT Kryštof','2026-08-03 09:22:23.437','cmrj6c19s0011mc7hsf5vv1x1',NULL),
('cmsd3sfee0005cmdai8upwl3q',NULL,'NOVA','MELŠOVÁ Petra','2026-08-03 10:45:40.982','cmsd3sf8w0003cmdas9mf65gq',NULL),
('cmsd4byw90005k07qics5pumb',NULL,'NOVA','MELŠOVÁ Petra','2026-08-03 11:00:52.713','cmsd4byqy0003k07qnpmkdeov',NULL);

insert into stg_comments(id,text,author,created_at,inquiry_id) values
('cmraiktqz00013ro0ntgk6905','Osobní návštěva 9.7.2026','HARANT Kryštof','2026-07-07 10:36:39.614','inq_0088'),
('cmrailp4c00033ro0fjxju9ak','Osobní návštěva 9.7.2026','MELŠOVÁ Petra','2026-07-07 10:37:20.272','inq_0088'),
('cmrj5imba0001mc7hhqgyc8vb','Nabídka na novou plničku (kopie stávající), další nabídka na obdobnou ale nemusí být z nerezu, 10 beden 1m3 kapacita s profukovacím dnem (otočné)','HARANT Kryštof','2026-07-13 11:40:57.243','inq_0087'),
('cmrj5m7c70005mc7hp6pf589o','Přidat magnetické separátory a udělat nový layout','HARANT Kryštof','2026-07-13 11:43:44.458','cmra6gihm000312ljl2xu1t16'),
('cmrj5t2k70007mc7h3g1wk24y','Čekáme na vyjádření (objednání)','HARANT Kryštof','2026-07-13 11:49:04.859','inq_0083'),
('cmrj5uelh0009mc7hw535byi7','Je třeba další jednání','HARANT Kryštof','2026-07-13 11:50:07.113','inq_0081'),
('cmrj5ypjt000dmc7h2gj2sese','V jednání s bankou, čekáme na vyjádření','HARANT Kryštof','2026-07-13 11:53:27.933','inq_0077'),
('cmrj60lhs000fmc7h1lscfr45','Layout','HARANT Kryštof','2026-07-13 11:54:56.08','inq_0074'),
('cmrkankc40001s4l763hxktci','📞 Výsledek hovoru: Kontaktováno, zákazník neodpovídá','HARANT Kryštof','2026-07-14 06:52:32.125','inq_0075'),
('cmrkayiwr00018zj623t252v0','📞 Výsledek hovoru: Nabídka byla zamítnuta na základě vysoké ceny zařízení','HARANT Kryštof','2026-07-14 07:01:03.487','inq_0075'),
('cmrkde9s900032hbb8l7m83fs','📞 Výsledek hovoru: Status změněn','HARANT Kryštof','2026-07-14 08:09:17.393','inq_0072'),
('cmrkki1dd0003f0qq62pl8k1s','14.7. vyžádání upřesnění parametrů.','MELŠOVÁ Petra','2026-07-14 11:28:10.518','inq_0071');

-- 1) Doplnit chybějící zákazníky (párování podle jména)
insert into customers (name, email, phone, address, country, contact_name, contact_phone, contact_email, created_at, updated_at)
select s.name, s.email, s.phone, s.address, s.country, s.contact_name, s.contact_phone, s.contact_email,
       coalesce(s.created_at::timestamptz, now()), coalesce(s.updated_at::timestamptz, now())
from stg_customers s
where not exists (select 1 from customers c where c.name = s.name);

-- Mapa: staré id zákazníka -> uuid v DB (podle jména)
create temporary table map_customer on commit drop as
select s.id as old_id, (
  select c.id from customers c where c.name = s.name order by c.created_at limit 1
) as new_id
from stg_customers s;

-- 2) Mapa odpovědných osob: kód -> profil (podle příjmení v profiles.name)
create temporary table map_person on commit drop as
select code, (select p.id from profiles p where p.name ilike pat order by p.name limit 1) as person_id
from (values
  ('person_jelinek',   '%jelínek%'),
  ('person_jedlicka',  '%jedlička%'),
  ('person_kadanik',   '%kadaník%'),
  ('person_vobornik',  '%voborník%'),
  ('person_jan_novak', '%novák%')
) m(code, pat);

-- 3) Doplnit chybějící kontaktní osoby (párování podle zákazníka+jména)
insert into contacts (customer_id, name, phone, email, created_at)
select mc.new_id, s.name, s.phone, s.email, coalesce(s.created_at::timestamptz, now())
from stg_contacts s
join map_customer mc on mc.old_id = s.customer_id
where mc.new_id is not null
  and not exists (
    select 1 from contacts c where c.customer_id = mc.new_id and lower(c.name) = lower(s.name)
  );

-- 4) Poptávky (deterministické id z původního; číslo zachováno)
insert into inquiries (
  id, number, received_at, subject, description, source, status, deadline,
  customer_id, person_id, contact_name, contact_phone, contact_email,
  reminder_sent, expired_notified, needs_contact, created_at, updated_at
)
select
  md5(s.id)::uuid,
  s.number::bigint,
  s.received_at::timestamptz,
  s.subject,
  s.description,
  s.source,
  s.status,
  case when coalesce(s.deadline,'')='' then null else s.deadline::timestamptz end,
  mc.new_id,
  mp.person_id,
  s.contact_name, s.contact_phone, s.contact_email,
  coalesce(lower(s.reminder_sent)='true', false),
  coalesce(lower(s.expired_notified)='true', false),
  coalesce(lower(s.needs_contact)='true', false),
  coalesce(s.created_at::timestamptz, now()),
  coalesce(s.updated_at::timestamptz, now())
from stg_inquiries s
join map_customer mc on mc.old_id = s.customer_id
left join map_person mp on mp.code = s.person_id
on conflict (id) do nothing;

-- 5) Historie stavů (navazuje přes md5 původního inquiryId)
insert into status_logs (id, inquiry_id, from_status, to_status, changed_by, note, created_at)
select md5(s.id)::uuid, md5(s.inquiry_id)::uuid, s.from_status, s.to_status,
       coalesce(s.changed_by,'?'), s.note, coalesce(s.created_at::timestamptz, now())
from stg_status s
where exists (select 1 from inquiries i where i.id = md5(s.inquiry_id)::uuid)
on conflict (id) do nothing;

-- 6) Komentáře
insert into comments (id, inquiry_id, text, author, created_at)
select md5(s.id)::uuid, md5(s.inquiry_id)::uuid, s.text, coalesce(s.author,'?'),
       coalesce(s.created_at::timestamptz, now())
from stg_comments s
where exists (select 1 from inquiries i where i.id = md5(s.inquiry_id)::uuid)
on conflict (id) do nothing;

-- 7) Posunout sekvenci čísel, aby další poptávka měla správné číslo
select setval(pg_get_serial_sequence('inquiries','number'),
              greatest((select max(number) from inquiries), 1));

-- Náhled výsledku (počty + nepřiřazené osoby):
select 'poptávky' as co, count(*)::text as pocet from inquiries
union all select 'historie stavů', count(*)::text from status_logs
union all select 'komentáře', count(*)::text from comments
union all select 'poptávky bez osoby', count(*)::text from inquiries where person_id is null;

commit;
