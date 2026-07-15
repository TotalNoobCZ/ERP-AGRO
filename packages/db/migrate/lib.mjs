// ----------------------------------------------------------------------------
//  Pomocná vrstva migrace: mapovací tabulka + dedup lidí podle e-mailu.
//  Idempotentní: opakované spuštění nevytváří duplicity (drží se `migrace_map`).
// ----------------------------------------------------------------------------
import { randomUUID } from "node:crypto";

/** Vytvoří (jednorázově) tabulku pro mapování starých id → nová uuid. */
export async function pripravMapu(target) {
  await target.query(`
    create table if not exists migrace_map (
      source    text not null,   -- 'poptavky' | 'planovani' | 'konstrukce'
      entita    text not null,   -- 'profile' | 'customer' | 'inquiry' | ...
      stary_id  text not null,
      novy_id   uuid not null,
      created_at timestamptz not null default now(),
      primary key (source, entita, stary_id)
    );
  `);
}

/** Vrátí nové uuid pro starý id, pokud už bylo zmapováno; jinak null. */
export async function najdiMapu(target, source, entita, staryId) {
  const r = await target.query(
    `select novy_id from migrace_map where source=$1 and entita=$2 and stary_id=$3`,
    [source, entita, String(staryId)],
  );
  return r.rows[0]?.novy_id ?? null;
}

export async function ulozMapu(target, source, entita, staryId, novyId) {
  await target.query(
    `insert into migrace_map (source, entita, stary_id, novy_id)
     values ($1,$2,$3,$4)
     on conflict (source, entita, stary_id) do nothing`,
    [source, entita, String(staryId), novyId],
  );
}

/**
 * Zajistí profil (dedup podle e-mailu). Když profil s daným e-mailem existuje,
 * použije se; jinak se založí. Vrací uuid profilu.
 * Lidé bez e-mailu (např. Dílna) dostanou syntetický e-mail, ať je splněn
 * unique/not-null a nedají se omylem sloučit s jiným člověkem.
 */
export async function zajistiProfil(target, { source, staryId, email, name, role, oddeleni, assignable, colorIndex, active, pozice, osobniCislo, poznamka }, dryRun) {
  // 1) už zmapováno pro tento zdroj?
  const zmapovano = await najdiMapu(target, source, "profile", staryId);
  if (zmapovano) return zmapovano;

  const emailNorm = (email || "").trim().toLowerCase() || `migrace-${source}-${staryId}@local.invalid`;

  // 2) existuje profil s tímto e-mailem? (dedup napříč zdroji)
  const ex = await target.query(`select id from profiles where email=$1`, [emailNorm]);
  let id = ex.rows[0]?.id;

  if (!id) {
    id = randomUUID();
    if (!dryRun) {
      await target.query(
        `insert into profiles (id, email, name, role, oddeleni, assignable, color_index, active, pozice, osobni_cislo, poznamka)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (email) do nothing`,
        [id, emailNorm, name || emailNorm, role || "viewer", oddeleni || null, !!assignable, colorIndex ?? null, active ?? true, pozice || null, osobniCislo || null, poznamka || null],
      );
      // kdyby mezitím vznikl (on conflict), načti reálné id
      const back = await target.query(`select id from profiles where email=$1`, [emailNorm]);
      id = back.rows[0]?.id ?? id;
    }
  }
  if (!dryRun) await ulozMapu(target, source, "profile", staryId, id);
  return id;
}

/**
 * Obecné založení řádku s přemapováním id. `staryId` se zmapuje na nové uuid.
 * `sloupce` = objekt {sloupec: hodnota}. Idempotentní přes migrace_map.
 * Vrací nové uuid.
 */
export async function vlozSMapou(target, { source, entita, staryId, tabulka, sloupce }, dryRun) {
  const zmapovano = await najdiMapu(target, source, entita, staryId);
  if (zmapovano) return zmapovano;

  const id = randomUUID();
  const cols = ["id", ...Object.keys(sloupce)];
  const vals = [id, ...Object.values(sloupce)];
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");

  if (!dryRun) {
    await target.query(`insert into ${tabulka} (${cols.join(",")}) values (${ph})`, vals);
    await ulozMapu(target, source, entita, staryId, id);
  }
  return id;
}

/** Datum → "YYYY-MM-DD" (pro sloupce typu date). */
export function den(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

/** Statistiky pro závěrečný přehled. */
export function pocitadlo() {
  const c = {};
  return {
    add: (k, n = 1) => (c[k] = (c[k] ?? 0) + n),
    vypis: () => c,
  };
}
