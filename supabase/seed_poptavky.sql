-- ============================================================================
--  Obnova / seed poptávek (inquiries)
-- ----------------------------------------------------------------------------
--  Spusť CELÝ tento soubor v Supabase → SQL Editoru. Založí 7 poptávek zpět
--  (i zákazníky, kontakty a první záznam historie stavu).
--  Idempotentní: opětovné spuštění nic nezduplikuje.
--
--  Stav (status): 'NOVA' | 'V_JEDNANI' | 'ODESLANA' | 'NEREAGUJE'
--                 | 'ODLOZENO' | 'OBJEDNANO' | 'ZAMITNUTO'
-- ============================================================================

create or replace function pg_temp.seed_poptavka(
  p_subject       text,
  p_customer      text,
  p_contact_name  text,
  p_contact_phone text,
  p_contact_email text,
  p_person        text,
  p_received_at   date,
  p_status        text,
  p_deadline      date default null
) returns void language plpgsql as $$
declare
  v_customer_id uuid;
  v_person_id   uuid;
  v_inquiry_id  uuid;
begin
  select id into v_customer_id from customers where name = p_customer limit 1;
  if v_customer_id is null then
    insert into customers (name) values (p_customer) returning id into v_customer_id;
  end if;

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

  if coalesce(btrim(p_person), '') <> '' then
    select id into v_person_id from profiles where name = btrim(p_person) limit 1;
  end if;

  -- Duplicitní poptávku nevkládat (předmět + zákazník + datum + kontakt).
  if exists (
    select 1 from inquiries
    where subject = p_subject
      and customer_id = v_customer_id
      and received_at::date = p_received_at
      and coalesce(contact_name, '') = coalesce(nullif(btrim(p_contact_name), ''), '')
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

-- ---------------------------------------------------------------------------

-- #102
select pg_temp.seed_poptavka(
  'Drtič', 'Plasma Chemical Technologies Department',
  'Jakub Pilař', '266 052 078', 'pilar@ipp.cas.cz',
  'HARANT Kryštof', '2026-08-03', 'NOVA'
);

-- #101
select pg_temp.seed_poptavka(
  'síto HS 80', 'TITAN',
  'Ahmed Mansour', '+20 120 090 806 5', 'Ahmed.Mansour@titan.com.eg',
  'HARANT Kryštof', '2026-08-03', 'NOVA'
);

-- #100
select pg_temp.seed_poptavka(
  'hvězdicový separátor', 'Melkov-WH',
  null, null, null,
  'JEDLIČKA Kamil', '2026-08-03', 'ODESLANA'
);

-- #99
select pg_temp.seed_poptavka(
  'drtič -staré popt. č.62', 'Kamiddos',
  'Kamil Petík', '777 261 519', 'petik@kamiddos.cz',
  'JELÍNEK Pavel', '2026-04-30', 'ODESLANA'
);

-- #98
select pg_temp.seed_poptavka(
  'hvězdicové síto', 'Qlar Czech s.r.o.',
  'Petr Rohlena', '775 409 049', 'p.rohlena@qlar.com',
  'JEDLIČKA Kamil', '2026-07-23', 'ODESLANA'
);

-- #97
select pg_temp.seed_poptavka(
  'hvězdicový separátor', 'Qlar Czech s.r.o.',
  'Petr Rohlena', '775 409 049', 'p.rohlena@qlar.com',
  'JEDLIČKA Kamil', '2026-07-23', 'ODESLANA'
);

-- #96
select pg_temp.seed_poptavka(
  'hvězdicový separátor', 'Qlar Czech s.r.o.',
  null, null, null,
  'JEDLIČKA Kamil', '2026-07-23', 'ODESLANA'
);
