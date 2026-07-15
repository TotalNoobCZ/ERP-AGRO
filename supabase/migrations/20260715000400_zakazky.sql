-- ============================================================================
--  20260715000400_zakazky.sql
--  Modul Zakázky (páteř systému) + plánování lidí.
--  Předloha: Planovani/prisma/schema.prisma
--  (Zakazka, Milnik, PrirazeniZakazka, PrirazeniMilnik, Preruseni,
--   Prodlouzeni, AkcePoznamka, AuditLog + enumy).
--  Změny proti originálu:
--   - Osoba + Uzivatel → profiles: všechny odkazy na lidi → profiles(id).
--   - NOVÉ cizí klíče (propojení modulů):
--       zakazky.inquiry_id  → inquiries(id)  (odkud zakázka vznikla)
--       zakazky.customer_id → customers(id)  (zděděný zákazník z poptávky)
-- ============================================================================

create table zakazky (
  id                 uuid primary key default gen_random_uuid(),
  kod                text not null unique,
  misto_plneni       text not null,
  priorita           int not null,              -- 1–5
  zacatek            date not null,
  konec_puvodni      date not null,
  konec_aktualni     date not null,
  stav               text not null default 'AKTIVNI'
                       check (stav in ('AKTIVNI','POZASTAVENO','DOKONCENO','ARCHIV')),
  archivovano_kdy    timestamptz,
  poznamka           text,

  zalozil_id         uuid not null references profiles (id) on delete restrict, -- dřívější zalozilUzivatel
  archivoval_id      uuid references profiles (id),
  odpovedna_osoba_id uuid references profiles (id),                             -- dřívější odpovednaOsoba

  -- NOVÉ – propojení modulů:
  inquiry_id         uuid references inquiries (id),   -- z jaké poptávky zakázka vznikla
  customer_id        uuid references customers (id),   -- zděděný zákazník

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz                       -- soft delete
);

create index zakazky_stav_idx           on zakazky (stav);
create index zakazky_konec_aktualni_idx on zakazky (konec_aktualni);
create index zakazky_kod_idx            on zakazky (kod);
create index zakazky_inquiry_id_idx     on zakazky (inquiry_id);
create index zakazky_customer_id_idx    on zakazky (customer_id);

create trigger zakazky_set_updated_at
  before update on zakazky
  for each row execute function set_updated_at();

-- Výrobní milníky (body v čase) navázané na zakázku.
create table milniky (
  id         uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references zakazky (id),
  typ        text not null
               check (typ in ('ZAHAJENI_VYROBY','PREDANI_LAKOVANI','UKONCENI_VYROBY','UKONCENI_LAKOVANI')),
  datum      date not null,
  cas        text,                              -- "HH:mm", nepovinné
  poznamka   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index milniky_zakazka_typ_idx on milniky (zakazka_id, typ);

create trigger milniky_set_updated_at
  before update on milniky
  for each row execute function set_updated_at();

-- Přiřazení osoby k zakázce (má rozsah od–do, vstupuje do kontroly kolizí).
create table prirazeni_zakazka (
  id         uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references zakazky (id),
  osoba_id   uuid not null references profiles (id),
  datum_od   date not null,
  datum_do   date not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index prirazeni_zakazka_osoba_idx   on prirazeni_zakazka (osoba_id);
create index prirazeni_zakazka_zakazka_idx on prirazeni_zakazka (zakazka_id);

-- Přiřazení osoby k milníku (bez rozsahu, nevstupuje do kolizí).
create table prirazeni_milnik (
  id         uuid primary key default gen_random_uuid(),
  milnik_id  uuid not null references milniky (id),
  osoba_id   uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index prirazeni_milnik_milnik_idx on prirazeni_milnik (milnik_id);

-- Přerušení (pozastavení) zakázky s pozdějším obnovením.
create table preruseni (
  id            uuid primary key default gen_random_uuid(),
  zakazka_id    uuid not null references zakazky (id),
  datum_od      date not null,                  -- začátek přerušení
  datum_do      date,                           -- obnovení (null = stále přerušeno)
  zbyvajici_dny int not null,
  duvod         text not null,
  prerusil_id   uuid not null references profiles (id),
  obnovil_id    uuid references profiles (id),
  created_at    timestamptz not null default now()
);

create index preruseni_zakazka_idx on preruseni (zakazka_id);

-- Historie prodloužení termínu.
create table prodlouzeni (
  id          uuid primary key default gen_random_uuid(),
  zakazka_id  uuid not null references zakazky (id),
  stary_konec date not null,
  novy_konec  date not null,
  duvod       text not null,
  provedl_id  uuid not null references profiles (id),
  created_at  timestamptz not null default now()
);

create index prodlouzeni_zakazka_idx on prodlouzeni (zakazka_id);

-- Poznámky k zakázce (více poznámek, každá s autorem a časem).
create table akce_poznamky (
  id          uuid primary key default gen_random_uuid(),
  zakazka_id  uuid not null references zakazky (id),
  uzivatel_id uuid not null references profiles (id),
  text        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index akce_poznamky_zakazka_idx on akce_poznamky (zakazka_id);

-- Auditní log změn (modul Zakázky).
create table audit_log (
  id              uuid primary key default gen_random_uuid(),
  entita          text not null,                -- "zakazka" | "milnik" | "prirazeni" | "osoba"
  entita_id       text not null,
  typ_zmeny       text not null
                    check (typ_zmeny in ('VYTVORENI','UPRAVA','SMAZANI','PRODLOUZENI','ARCHIVACE')),
  puvodni_hodnota jsonb,
  nova_hodnota    jsonb,
  uzivatel_id     uuid not null references profiles (id),
  created_at      timestamptz not null default now()
);

create index audit_log_entita_idx on audit_log (entita, entita_id);
