-- ============================================================================
--  20260715000200_shared_customers.sql
--  Sdílené entity zákazníků (z modulu Poptávky). Sdílené napříč moduly –
--  zákazník se z poptávky dědí do zakázky (viz 0004: zakazky.customer_id).
--  Předloha: Popt-vky/prisma/schema.prisma (model Customer, Contact).
-- ============================================================================

create table customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- jméno nebo název firmy
  email         text,
  phone         text,
  address       text,
  country       text,                          -- stát (předvolba telefonu)
  contact_name  text,                          -- kontaktní osoba u zákazníka
  contact_phone text,
  contact_email text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index customers_name_idx on customers (name);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- Kontaktní osoba u zákazníka (firma může mít víc kontaktů).
create table contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);

create index contacts_customer_id_idx on contacts (customer_id);
