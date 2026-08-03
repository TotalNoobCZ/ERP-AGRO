-- ============================================================================
--  Seed: doplnění poptávek (inquiries)
-- ----------------------------------------------------------------------------
--  Jak to funguje:
--   • Pro každou poptávku je jeden blok „-- >>> POPTÁVKA".
--   • Zákazník i kontaktní osoba se DOHLEDAJÍ podle jména; pokud neexistují,
--     automaticky se založí (customers, contacts).
--   • Odpovědná osoba (person_id) se dohledá v profiles podle jména – MUSÍ
--     už existovat (zakládá se ve Správě). Když jméno nesedí, person_id = NULL.
--   • „number" (#102 …) se přiděluje automaticky – NEzadává se.
--   • Seed je idempotentní: stejná poptávka (shodný subject + zákazník
--     + received_at) se podruhé nevloží.
--   • Založí i první záznam historie stavu (status_logs).
--
--  Stav (status): 'NOVA' | 'V_JEDNANI' | 'ODESLANA' | 'NEREAGUJE'
--                 | 'ODLOZENO' | 'OBJEDNANO' | 'ZAMITNUTO'
--
--  Postup: zkopíruj blok, vyplň hodnoty, spusť v Supabase → SQL editoru.
-- ============================================================================

-- Pomocná funkce: založí zákazníka/kontakt a vloží poptávku, pokud ještě není.
-- (dočasná, na konci se zahodí – nezůstává v DB)
create or replace function pg_temp.seed_poptavka(
  p_subject       text,
  p_customer      text,
  p_contact_name  text,
  p_contact_phone text,
  p_contact_email text,
  p_person        text,          -- jméno odpovědné osoby (profiles.name) nebo NULL
  p_received_at   date,
  p_status        text,
  p_deadline      date default null
) returns void language plpgsql as $$
declare
  v_customer_id uuid;
  v_person_id   uuid;
  v_inquiry_id  uuid;
begin
  -- Zákazník – dohledat, jinak založit
  select id into v_customer_id from customers where name = p_customer limit 1;
  if v_customer_id is null then
    insert into customers (name) values (p_customer) returning id into v_customer_id;
  end if;

  -- Kontaktní osoba – doplnit do contacts, pokud tam ještě není
  if coalesce(btrim(p_contact_name), '') <> '' then
    if not exists (
      select 1 from contacts
      where customer_id = v_customer_id and lower(name) = lower(btrim(p_contact_name))
    ) then
      insert into contacts (customer_id, name, phone, email)
      values (v_customer_id, btrim(p_contact_name),
              nullif(btrim(p_contact_phone), ''), nullif(btrim(p_contact_email), ''));
    end if;
  end if;

  -- Odpovědná osoba (nepovinná)
  if coalesce(btrim(p_person), '') <> '' then
    select id into v_person_id from profiles where name = btrim(p_person) limit 1;
  end if;

  -- Duplicitní poptávku nevkládat
  if exists (
    select 1 from inquiries
    where subject = p_subject
      and customer_id = v_customer_id
      and received_at::date = p_received_at
  ) then
    return;
  end if;

  insert into inquiries (
    subject, customer_id, person_id,
    contact_name, contact_phone, contact_email,
    received_at, deadline, status
  ) values (
    p_subject, v_customer_id, v_person_id,
    nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_phone), ''), nullif(btrim(p_contact_email), ''),
    p_received_at::timestamptz,
    case when p_deadline is null then null else p_deadline::timestamptz end,
    p_status
  ) returning id into v_inquiry_id;

  insert into status_logs (inquiry_id, from_status, to_status, changed_by)
  values (v_inquiry_id, null, p_status, coalesce(nullif(btrim(p_person), ''), 'seed'));
end;
$$;

-- ============================================================================
--  POPTÁVKY – sem doplňuj řádky (pořadí: předmět, zákazník, kontakt, telefon,
--  e-mail, odpovědná osoba, přijato (RRRR-MM-DD), stav, [termín])
-- ============================================================================

-- >>> POPTÁVKA (příklad – uprav nebo smaž)
select pg_temp.seed_poptavka(
  'Předmět poptávky',                 -- subject
  'Název zákazníka s.r.o.',           -- zákazník
  'Jan Novák',                        -- kontaktní osoba
  '777 123 456',                      -- telefon
  'jan.novak@firma.cz',               -- e-mail
  'HARANT Kryštof',                   -- odpovědná osoba (přesné jméno z profilů) nebo NULL
  '2026-08-03',                       -- přijato
  'NOVA'                              -- stav
  -- , '2026-09-15'                   -- (nepovinný) termín
);

-- >>> POPTÁVKA
-- select pg_temp.seed_poptavka('…', '…', '…', '…', '…', '…', '2026-08-03', 'ODESLANA');


-- Úklid pomocné funkce (dočasná, mizí i tak s koncem session – ponecháno pro jistotu)
-- drop function if exists pg_temp.seed_poptavka(text,text,text,text,text,text,date,text,date);
