import { addDays } from "./dates";

export const PX_ZA_DEN = 22;

/** Počet dní mezi dvěma dny (b - a), bez ohledu na čas. */
export function dniMezi(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Offset (v pixelech) začátku dne od začátku osy. */
export function offsetPx(datum: Date, start: Date): number {
  return dniMezi(start, datum) * PX_ZA_DEN;
}

/** Šířka (v pixelech) intervalu od–do včetně obou dnů. */
export function sirkaPx(od: Date, doo: Date): number {
  return (dniMezi(od, doo) + 1) * PX_ZA_DEN;
}

/** Celková šířka osy. */
export function celkovaSirka(start: Date, konec: Date): number {
  return (dniMezi(start, konec) + 1) * PX_ZA_DEN;
}

export type MesicniZnacka = { label: string; offset: number };

const MESICE = [
  "led", "úno", "bře", "dub", "kvě", "čvn",
  "čvc", "srp", "zář", "říj", "lis", "pro",
];

/** Značky na začátcích měsíců v rámci okna. */
export function mesicniZnacky(start: Date, konec: Date): MesicniZnacka[] {
  const znacky: MesicniZnacka[] = [];
  let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  if (d < start) d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  while (d <= konec) {
    znacky.push({
      label: `${MESICE[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      offset: offsetPx(d, start),
    });
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
  return znacky;
}

/** Interval s libovolnými daty navíc. */
export type SLane<T> = T & { od: Date; do: Date; lane: number };

/**
 * Rozdělí překrývající se intervaly do řad (lanes) tak, aby se v jedné řadě
 * nic nepřekrývalo. Dva prvky ve stejném čase v různých řadách = kolize (dvojí nasazení).
 */
export function baleniDoRad<T extends { od: Date; do: Date }>(
  items: T[]
): { prvky: SLane<T>[]; pocetRad: number } {
  const seřazené = [...items].sort((a, b) => a.od.getTime() - b.od.getTime());
  const konceRad: Date[] = [];
  const prvky: SLane<T>[] = [];

  for (const it of seřazené) {
    let lane = konceRad.findIndex((konec) => it.od > konec);
    if (lane === -1) {
      lane = konceRad.length;
      konceRad.push(it.do);
    } else {
      konceRad[lane] = it.do;
    }
    prvky.push({ ...it, lane });
  }
  return { prvky, pocetRad: Math.max(1, konceRad.length) };
}

/** Okno: první den daného měsíce a poslední den měsíce o `mesicu` dál. */
export function okno(kolemData: Date, mesicu = 3): { start: Date; konec: Date } {
  const start = new Date(Date.UTC(kolemData.getUTCFullYear(), kolemData.getUTCMonth(), 1));
  const konec = new Date(Date.UTC(kolemData.getUTCFullYear(), kolemData.getUTCMonth() + mesicu, 0));
  return { start, konec };
}
