// ----------------------------------------------------------------------------
//  Report pro vedení – čisté výpočty nad plochými řádky (bez závislostí),
//  aby šly jednotkově otestovat (scripts/test-report.ts) a sdílet mezi
//  obrazovkou /report a tiskovou verzí.
//  Data v ERP nesou termíny a stavy (peníze v systému nejsou) → report je
//  provozní: průtok poptávek, termínová disciplína akcí a vytížení lidí.
// ----------------------------------------------------------------------------

/** Kalendářní měsíc jako ISO rozsah (včetně obou krajů). */
export type Obdobi = { od: string; do: string };

/** „YYYY-MM" (neplatné → aktuální měsíc z `dnes`) → celý kalendářní měsíc. */
export function mesicniOkno(ref: string | undefined, dnes: string): Obdobi {
  const zdroj = ref && /^\d{4}-\d{2}$/.test(ref) ? ref : dnes.slice(0, 7);
  const [y, m] = zdroj.split("-").map(Number);
  const posledni = new Date(Date.UTC(y!, m!, 0)).getUTCDate(); // den 0 dalšího měsíce
  return { od: `${zdroj}-01`, do: `${zdroj}-${String(posledni).padStart(2, "0")}` };
}

/** Posledních `n` měsíců končících měsícem `ref` („YYYY-MM"), vzestupně. */
export function radaMesicu(ref: string, n: number): string[] {
  const [y, m] = ref.split("-").map(Number);
  const rada: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y!, m! - 1 - i, 1));
    rada.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return rada;
}

/** Počet pracovních dní (po–pá) v ISO rozsahu včetně krajů; prázdný rozsah → 0. */
export function pracovniDny(od: string, doDne: string): number {
  if (od > doDne) return 0;
  const d = new Date(`${od}T00:00:00Z`);
  const konec = new Date(`${doDne}T00:00:00Z`);
  let n = 0;
  while (d <= konec) {
    const den = d.getUTCDay();
    if (den !== 0 && den !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

/**
 * Sjednotí ISO rozsahy oříznuté na období (překryvy a duplicity se počítají
 * jednou) a vrátí počet pracovních dní, které pokrývají.
 */
export function pokrytePracovniDny(rozsahy: { od: string; do: string }[], obdobi: Obdobi): number {
  const oriznute = rozsahy
    .map((r) => ({ od: r.od < obdobi.od ? obdobi.od : r.od, do: r.do > obdobi.do ? obdobi.do : r.do }))
    .filter((r) => r.od <= r.do)
    .sort((a, b) => a.od.localeCompare(b.od));
  let dny = 0;
  let konecPosledniho: string | null = null;
  for (const r of oriznute) {
    // začátek za koncem už započteného úseku → ořízni zleva
    const od = konecPosledniho && r.od <= konecPosledniho ? dalsiDen(konecPosledniho) : r.od;
    if (od > r.do) continue;
    dny += pracovniDny(od, r.do);
    if (!konecPosledniho || r.do > konecPosledniho) konecPosledniho = r.do;
  }
  return dny;
}

function dalsiDen(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Vytížení osoby v období: podíl pracovních dní pokrytých přiřazením (0–1). */
export function vytizeniOsoby(
  prirazeni: { od: string; do: string }[],
  obdobi: Obdobi,
): { pokryto: number; fond: number; podil: number } {
  const fond = pracovniDny(obdobi.od, obdobi.do);
  const pokryto = pokrytePracovniDny(prirazeni, obdobi);
  return { pokryto, fond, podil: fond === 0 ? 0 : pokryto / fond };
}

/** Úspěšnost poptávek: objednáno / uzavřené (objednáno + zamítnuto); bez uzavřených → null. */
export function uspesnostPoptavek(objednano: number, zamitnuto: number): number | null {
  const uzavrene = objednano + zamitnuto;
  return uzavrene === 0 ? null : objednano / uzavrene;
}

/** Patří ISO datum do období? (kraje včetně) */
export function vObdobi(datum: string, obdobi: Obdobi): boolean {
  const den = datum.slice(0, 10);
  return den >= obdobi.od && den <= obdobi.do;
}

/** Celé dny mezi dvěma ISO daty (b − a); záporné, když b < a. */
export function dniMezi(a: string, b: string): number {
  const ms = Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
