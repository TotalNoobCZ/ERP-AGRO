#!/usr/bin/env node
// ============================================================================
//  Migrace ostrých dat ze tří starých aplikací do sjednocené ERP databáze.
//  Zdroje: Postgres (Poptávky = Prisma, Plánování = Prisma, Konstrukce =
//  Supabase). Cíl: nová Supabase (přímé připojení, port 5432).
//
//  Spuštění:
//    SRC_POPTAVKY_URL=postgres://...       (read-only stačí)
//    SRC_PLANOVANI_URL=postgres://...
//    SRC_KONSTRUKCE_URL=postgres://...     (volitelné)
//    TARGET_DATABASE_URL=postgres://...    (nová DB, DIRECT_URL port 5432)
//    node packages/db/migrate/migrate.mjs [--dry-run] [--only=poptavky,planovani,konstrukce]
//
//  --dry-run  = nic nezapíše, jen vypíše, co by udělal.
//  Idempotentní: opakované spuštění nevytváří duplicity (migrace_map).
//
//  Pořadí kvůli cizím klíčům: profiles → customers → poptavky → planovani →
//  konstrukce. Lidé se dedupují podle e-mailu napříč všemi zdroji.
// ============================================================================
import pg from "pg";
import { pripravMapu, zajistiProfil, vlozSMapou, najdiMapu, den, pocitadlo } from "./lib.mjs";

const { Client } = pg;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1].split(",") : ["poptavky", "planovani", "konstrukce"];
const stat = pocitadlo();

function log(...a) { console.log(...a); }
function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Chybí proměnná prostředí ${name}`);
  return v;
}

async function connect(url) {
  const c = new Client({ connectionString: url });
  await c.connect();
  return c;
}

// ---- Poptávky --------------------------------------------------------------
async function migratePoptavky(src, target) {
  log("\n== Poptávky ==");
  const S = "poptavky";

  // Person → profiles (účet obchodníka)
  const persons = await src.query(`select * from "Person"`);
  for (const p of persons.rows) {
    await zajistiProfil(target, {
      source: S, staryId: p.id, email: p.email, name: p.name,
      role: "editor", oddeleni: "obchod", assignable: false, active: p.active,
    }, dryRun);
    stat.add("profiles");
  }

  // Customer → customers
  const customers = await src.query(`select * from "Customer"`);
  for (const c of customers.rows) {
    await vlozSMapou(target, {
      source: S, entita: "customer", staryId: c.id, tabulka: "customers",
      sloupce: {
        name: c.name, email: c.email, phone: c.phone, address: c.address, country: c.country,
        contact_name: c.contactName, contact_phone: c.contactPhone, contact_email: c.contactEmail,
        created_at: c.createdAt, updated_at: c.updatedAt,
      },
    }, dryRun);
    stat.add("customers");
  }

  // Contact → contacts
  const contacts = await src.query(`select * from "Contact"`);
  for (const c of contacts.rows) {
    const customerId = await najdiMapu(target, S, "customer", c.customerId);
    if (!customerId) continue;
    await vlozSMapou(target, {
      source: S, entita: "contact", staryId: c.id, tabulka: "contacts",
      sloupce: { customer_id: customerId, name: c.name, phone: c.phone, email: c.email, created_at: c.createdAt },
    }, dryRun);
    stat.add("contacts");
  }

  // Inquiry → inquiries
  const inquiries = await src.query(`select * from "Inquiry"`);
  for (const i of inquiries.rows) {
    const customerId = await najdiMapu(target, S, "customer", i.customerId);
    const personId = await najdiMapu(target, S, "profile", i.personId);
    if (!customerId || !personId) continue;
    await vlozSMapou(target, {
      source: S, entita: "inquiry", staryId: i.id, tabulka: "inquiries",
      sloupce: {
        number: i.number, received_at: i.receivedAt, subject: i.subject, description: i.description,
        source: i.source, contact_name: i.contactName, contact_phone: i.contactPhone, contact_email: i.contactEmail,
        status: i.status, deadline: i.deadline, customer_id: customerId, person_id: personId,
        reminder_sent: i.reminderSent, expired_notified: i.expiredNotified, needs_contact: i.needsContact,
        created_at: i.createdAt, updated_at: i.updatedAt,
      },
    }, dryRun);
    stat.add("inquiries");
  }

  // Comment → comments
  const comments = await src.query(`select * from "Comment"`);
  for (const c of comments.rows) {
    const inquiryId = await najdiMapu(target, S, "inquiry", c.inquiryId);
    if (!inquiryId) continue;
    await vlozSMapou(target, {
      source: S, entita: "comment", staryId: c.id, tabulka: "comments",
      sloupce: { inquiry_id: inquiryId, text: c.text, author: c.author, created_at: c.createdAt },
    }, dryRun);
    stat.add("comments");
  }

  // StatusLog → status_logs
  const logs = await src.query(`select * from "StatusLog"`);
  for (const l of logs.rows) {
    const inquiryId = await najdiMapu(target, S, "inquiry", l.inquiryId);
    if (!inquiryId) continue;
    await vlozSMapou(target, {
      source: S, entita: "status_log", staryId: l.id, tabulka: "status_logs",
      sloupce: { inquiry_id: inquiryId, from_status: l.fromStatus, to_status: l.toStatus, changed_by: l.changedBy, note: l.note, created_at: l.createdAt },
    }, dryRun);
    stat.add("status_logs");
  }
}

// ---- Plánování -------------------------------------------------------------
async function migratePlanovani(src, target) {
  log("\n== Plánování ==");
  const S = "planovani";
  const ODD = { DILNA: "dilna", KANCELAR: "kancelar", ELEKTRO: "elektro" };
  const ROLE = { ADMIN: "admin", NADRIZENY: "editor", NAHLED: "viewer" };

  // Osoba → profiles (pracovníci; role se případně povýší z Uzivatel níže)
  const osoby = await src.query(`select * from "Osoba"`);
  for (const o of osoby.rows) {
    await zajistiProfil(target, {
      source: S, staryId: o.id, email: o.email,
      name: `${o.jmeno} ${o.prijmeni}`.trim(),
      role: "viewer", oddeleni: ODD[o.oddeleni] ?? null, assignable: true,
      active: o.aktivni, pozice: o.pozice, osobniCislo: o.osobniCislo, poznamka: o.poznamka,
    }, dryRun);
    stat.add("profiles");
  }

  // Uzivatel → povýší roli profilu (mapuje se na osobu, nebo vlastní e-mail)
  const uzivatele = await src.query(`select * from "Uzivatel"`);
  const uzivatelProfil = new Map(); // Uzivatel.id → profile uuid
  for (const u of uzivatele.rows) {
    let profileId = u.osobaId ? await najdiMapu(target, S, "profile", u.osobaId) : null;
    if (!profileId) {
      // Uživatel bez osoby → samostatný profil dle e-mailu.
      profileId = await zajistiProfil(target, {
        source: S, staryId: `u-${u.id}`, email: u.email, name: u.email,
        role: ROLE[u.role] ?? "viewer", assignable: false, active: u.aktivni,
      }, dryRun);
    } else if (!dryRun) {
      await target.query(`update profiles set role=$1 where id=$2`, [ROLE[u.role] ?? "viewer", profileId]);
    }
    uzivatelProfil.set(String(u.id), profileId);
  }
  const uProfil = (id) => (id == null ? null : uzivatelProfil.get(String(id)) ?? null);

  // Zakazka → zakazky
  const zakazky = await src.query(`select * from "Zakazka"`);
  for (const z of zakazky.rows) {
    const zalozilId = uProfil(z.zalozilUzivatelId);
    if (!zalozilId) continue; // zalozil_id je NOT NULL
    await vlozSMapou(target, {
      source: S, entita: "zakazka", staryId: z.id, tabulka: "zakazky",
      sloupce: {
        kod: z.kod, misto_plneni: z.mistoPlneni, priorita: z.priorita,
        zacatek: den(z.zacatek), konec_puvodni: den(z.konecPuvodni), konec_aktualni: den(z.konecAktualni),
        stav: z.stav, archivovano_kdy: z.archivovanoKdy, poznamka: z.poznamka,
        zalozil_id: zalozilId, archivoval_id: uProfil(z.archivovalUzivatelId),
        odpovedna_osoba_id: z.odpovednaOsobaId ? await najdiMapu(target, S, "profile", z.odpovednaOsobaId) : null,
        created_at: z.createdAt, updated_at: z.updatedAt, deleted_at: z.deletedAt,
      },
    }, dryRun);
    stat.add("zakazky");
  }

  // Milnik → milniky
  const milniky = await src.query(`select * from "Milnik"`);
  for (const m of milniky.rows) {
    const zakazkaId = await najdiMapu(target, S, "zakazka", m.zakazkaId);
    if (!zakazkaId) continue;
    await vlozSMapou(target, {
      source: S, entita: "milnik", staryId: m.id, tabulka: "milniky",
      sloupce: { zakazka_id: zakazkaId, typ: m.typ, datum: den(m.datum), cas: m.cas, poznamka: m.poznamka, created_at: m.createdAt, updated_at: m.updatedAt, deleted_at: m.deletedAt },
    }, dryRun);
    stat.add("milniky");
  }

  // PrirazeniZakazka → prirazeni_zakazka
  const prz = await src.query(`select * from "PrirazeniZakazka"`);
  for (const p of prz.rows) {
    const zakazkaId = await najdiMapu(target, S, "zakazka", p.zakazkaId);
    const osobaId = await najdiMapu(target, S, "profile", p.osobaId);
    if (!zakazkaId || !osobaId) continue;
    await vlozSMapou(target, {
      source: S, entita: "prirazeni_zakazka", staryId: p.id, tabulka: "prirazeni_zakazka",
      sloupce: { zakazka_id: zakazkaId, osoba_id: osobaId, datum_od: den(p.datumOd), datum_do: den(p.datumDo), created_at: p.createdAt, deleted_at: p.deletedAt },
    }, dryRun);
    stat.add("prirazeni_zakazka");
  }

  // PrirazeniMilnik → prirazeni_milnik
  const prm = await src.query(`select * from "PrirazeniMilnik"`);
  for (const p of prm.rows) {
    const milnikId = await najdiMapu(target, S, "milnik", p.milnikId);
    const osobaId = await najdiMapu(target, S, "profile", p.osobaId);
    if (!milnikId || !osobaId) continue;
    await vlozSMapou(target, {
      source: S, entita: "prirazeni_milnik", staryId: p.id, tabulka: "prirazeni_milnik",
      sloupce: { milnik_id: milnikId, osoba_id: osobaId, created_at: p.createdAt, deleted_at: p.deletedAt },
    }, dryRun);
    stat.add("prirazeni_milnik");
  }

  // Preruseni → preruseni
  const preruseni = await src.query(`select * from "Preruseni"`);
  for (const p of preruseni.rows) {
    const zakazkaId = await najdiMapu(target, S, "zakazka", p.zakazkaId);
    const prerusilId = uProfil(p.prerusilUzivatelId);
    if (!zakazkaId || !prerusilId) continue;
    await vlozSMapou(target, {
      source: S, entita: "preruseni", staryId: p.id, tabulka: "preruseni",
      sloupce: { zakazka_id: zakazkaId, datum_od: den(p.datumOd), datum_do: den(p.datumDo), zbyvajici_dny: p.zbyvajiciDny, duvod: p.duvod, prerusil_id: prerusilId, obnovil_id: uProfil(p.obnovilUzivatelId), created_at: p.createdAt },
    }, dryRun);
    stat.add("preruseni");
  }

  // Prodlouzeni → prodlouzeni
  const prodl = await src.query(`select * from "Prodlouzeni"`);
  for (const p of prodl.rows) {
    const zakazkaId = await najdiMapu(target, S, "zakazka", p.zakazkaId);
    const provedlId = uProfil(p.provedlUzivatelId);
    if (!zakazkaId || !provedlId) continue;
    await vlozSMapou(target, {
      source: S, entita: "prodlouzeni", staryId: p.id, tabulka: "prodlouzeni",
      sloupce: { zakazka_id: zakazkaId, stary_konec: den(p.staryKonec), novy_konec: den(p.novyKonec), duvod: p.duvod, provedl_id: provedlId, created_at: p.createdAt },
    }, dryRun);
    stat.add("prodlouzeni");
  }

  // AkcePoznamka → akce_poznamky
  const akce = await src.query(`select * from "AkcePoznamka"`);
  for (const p of akce.rows) {
    const zakazkaId = await najdiMapu(target, S, "zakazka", p.zakazkaId);
    const uzivatelId = uProfil(p.uzivatelId);
    if (!zakazkaId || !uzivatelId) continue;
    await vlozSMapou(target, {
      source: S, entita: "akce_poznamka", staryId: p.id, tabulka: "akce_poznamky",
      sloupce: { zakazka_id: zakazkaId, uzivatel_id: uzivatelId, text: p.text, created_at: p.createdAt, deleted_at: p.deletedAt },
    }, dryRun);
    stat.add("akce_poznamky");
  }

  // AuditLog → audit_log
  const audit = await src.query(`select * from "AuditLog"`);
  for (const a of audit.rows) {
    const uzivatelId = uProfil(a.uzivatelId);
    if (!uzivatelId) continue;
    // entita_id přemapujeme, jde-li (zakazka/milnik); jinak ponecháme text.
    let entitaId = a.entitaId;
    if (a.entita === "zakazka") entitaId = (await najdiMapu(target, S, "zakazka", a.entitaId)) ?? a.entitaId;
    else if (a.entita === "milnik") entitaId = (await najdiMapu(target, S, "milnik", a.entitaId)) ?? a.entitaId;
    await vlozSMapou(target, {
      source: S, entita: "audit_log", staryId: a.id, tabulka: "audit_log",
      sloupce: { entita: a.entita, entita_id: entitaId, typ_zmeny: a.typZmeny, puvodni_hodnota: a.puvodniHodnota, nova_hodnota: a.novaHodnota, uzivatel_id: uzivatelId, created_at: a.createdAt },
    }, dryRun);
    stat.add("audit_log");
  }
}

// ---- Konstrukce ------------------------------------------------------------
//  Pozn.: staré konstrukční projekty NEMĚLY zakázku, ale nový model vyžaduje
//  projects.zakazka_id NOT NULL. Osiřelé projekty proto navěsíme na jednu
//  „přechodovou" zakázku MIGRACE-KONSTRUKCE (dohledá se / založí).
async function migrateKonstrukce(src, target) {
  log("\n== Konstrukce ==");
  const S = "konstrukce";
  const ROLE = { write: "editor", read: "viewer" };

  // profiles → profiles (dedup dle e-mailu; přebírá barvu a přiřaditelnost)
  const profiles = await src.query(`select * from profiles`);
  for (const p of profiles.rows) {
    await zajistiProfil(target, {
      source: S, staryId: p.id, email: p.email, name: p.name,
      role: ROLE[p.role] ?? "viewer", oddeleni: "konstrukce",
      assignable: p.has_tile ?? p.assignable ?? false, colorIndex: p.color_index, active: true,
    }, dryRun);
    stat.add("profiles");
  }

  // Přechodová zakázka pro osiřelé projekty.
  let migraceZakId = null;
  {
    const ex = await target.query(`select id from zakazky where kod=$1`, ["MIGRACE-KONSTRUKCE"]);
    migraceZakId = ex.rows[0]?.id ?? null;
    if (!migraceZakId && !dryRun) {
      const zalozil = await target.query(`select id from profiles order by created_at asc limit 1`);
      const r = await target.query(
        `insert into zakazky (kod, misto_plneni, priorita, zacatek, konec_puvodni, konec_aktualni, stav, zalozil_id, poznamka)
         values ('MIGRACE-KONSTRUKCE','—',5,current_date,current_date,current_date,'AKTIVNI',$1,'Přechodová zakázka pro konstrukční projekty bez vazby (migrace).')
         returning id`,
        [zalozil.rows[0].id],
      );
      migraceZakId = r.rows[0].id;
    }
  }

  // projects → projects
  const projects = await src.query(`select * from projects`);
  for (const p of projects.rows) {
    await vlozSMapou(target, {
      source: S, entita: "project", staryId: p.id, tabulka: "projects",
      sloupce: {
        zakazka_id: migraceZakId, name: p.name,
        owner_id: p.owner_id ? await najdiMapu(target, S, "profile", p.owner_id) : null,
        status: p.status ?? "active",
        archived_by: p.archived_by ? await najdiMapu(target, S, "profile", p.archived_by) : null,
        archived_at: p.archived_at, created_at: p.created_at,
      },
    }, dryRun);
    stat.add("projects");
  }

  // tasks → tasks
  const tasks = await src.query(`select * from tasks`);
  for (const t of tasks.rows) {
    const projectId = await najdiMapu(target, S, "project", t.project_id);
    if (!projectId) continue;
    await vlozSMapou(target, {
      source: S, entita: "task", staryId: t.id, tabulka: "tasks",
      sloupce: {
        project_id: projectId, name: t.name,
        assignee_id: t.assignee_id ? await najdiMapu(target, S, "profile", t.assignee_id) : null,
        start_date: den(t.start_date), end_date: den(t.end_date), duration_days: t.duration_days,
        completed: t.completed, completed_at: t.completed_at, order_in_member: t.order_in_member,
        status: t.status ?? "active",
        archived_by: t.archived_by ? await najdiMapu(target, S, "profile", t.archived_by) : null,
        archived_at: t.archived_at, created_at: t.created_at,
      },
    }, dryRun);
    stat.add("tasks");
  }

  // task_notes, task_todos, project_notes, project_todos, absences
  for (const [tbl, ent, parentEnt, parentCol] of [
    ["task_notes", "task_note", "task", "task_id"],
    ["task_todos", "task_todo", "task", "task_id"],
    ["project_notes", "project_note", "project", "project_id"],
    ["project_todos", "project_todo", "project", "project_id"],
  ]) {
    const rows = await src.query(`select * from ${tbl}`);
    for (const r of rows.rows) {
      const parentId = await najdiMapu(target, S, parentEnt, r[parentCol]);
      if (!parentId) continue;
      const sloupce = { [parentCol]: parentId };
      if ("body" in r) sloupce.body = r.body;
      if ("done" in r) sloupce.done = r.done;
      if ("position" in r) sloupce.position = r.position;
      if ("created_at" in r) sloupce.created_at = r.created_at;
      if ("author_id" in r) sloupce.author_id = r.author_id ? await najdiMapu(target, S, "profile", r.author_id) : null;
      await vlozSMapou(target, { source: S, entita: ent, staryId: r.id, tabulka: tbl, sloupce }, dryRun);
      stat.add(tbl);
    }
  }

  const absences = await src.query(`select * from absences`);
  for (const a of absences.rows) {
    const profileId = await najdiMapu(target, S, "profile", a.profile_id);
    if (!profileId) continue;
    await vlozSMapou(target, {
      source: S, entita: "absence", staryId: a.id, tabulka: "absences",
      sloupce: { profile_id: profileId, type: a.type, start_date: den(a.start_date), end_date: den(a.end_date) },
    }, dryRun);
    stat.add("absences");
  }
}

// ---- Main ------------------------------------------------------------------
async function main() {
  log(dryRun ? "DRY-RUN (nic se nezapisuje)\n" : "OSTRÁ MIGRACE\n");
  const target = await connect(need("TARGET_DATABASE_URL"));
  await pripravMapu(target);

  try {
    if (only.includes("poptavky")) {
      const src = await connect(need("SRC_POPTAVKY_URL"));
      await migratePoptavky(src, target); await src.end();
    }
    if (only.includes("planovani")) {
      const src = await connect(need("SRC_PLANOVANI_URL"));
      await migratePlanovani(src, target); await src.end();
    }
    if (only.includes("konstrukce") && process.env.SRC_KONSTRUKCE_URL) {
      const src = await connect(process.env.SRC_KONSTRUKCE_URL);
      await migrateKonstrukce(src, target); await src.end();
    } else if (only.includes("konstrukce")) {
      log("\n== Konstrukce == přeskočeno (SRC_KONSTRUKCE_URL nenastaveno)");
    }
  } finally {
    await target.end();
  }

  log("\n== Přehled ==");
  for (const [k, v] of Object.entries(stat.vypis())) log(`  ${k}: ${v}`);
  log(dryRun ? "\nDRY-RUN hotový. Pro ostrou migraci spusť bez --dry-run." : "\nMigrace dokončena.");
}

main().catch((e) => { console.error("CHYBA:", e.message); process.exit(1); });
