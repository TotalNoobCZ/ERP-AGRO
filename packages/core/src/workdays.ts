// ----------------------------------------------------------------------------
//  Práce s pracovními dny (jádro plánovací logiky Konstrukce, ZADANI.md kap. 9).
//  Čisté funkce bez závislostí – testovatelné samostatně.
//  Datum se předává jako ISO string "YYYY-MM-DD" (odpovídá sloupcům `date`).
// ----------------------------------------------------------------------------

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(iso: string): boolean {
  const day = toDate(iso).getUTCDay();
  return day === 0 || day === 6;
}

/** Posune datum na nejbližší pracovní den (vpřed). */
export function nextWorkday(iso: string): string {
  const d = toDate(iso);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return toIso(d);
}

/**
 * Konec = Začátek + (Trvání pracovních dní) – 1, víkendy se přeskakují.
 * durationDays >= 1; start se nejdřív srovná na pracovní den.
 */
export function addWorkdays(startIso: string, durationDays: number): string {
  let remaining = Math.max(1, durationDays);
  const d = toDate(nextWorkday(startIso));
  while (remaining > 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) remaining--;
  }
  return toIso(d);
}

/** Počet pracovních dní mezi start a end (včetně obou krajů). */
export function workdaysBetween(startIso: string, endIso: string): number {
  const d = toDate(startIso);
  const end = toDate(endIso);
  let count = 0;
  while (d <= end) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// ----------------------------------------------------------------------------
//  Dopočítání tří polí Začátek / Konec / Trvání (vyplněním dvou vznikne třetí):
//    přepíšu Začátek → drží Trvání, přepočte se Konec
//    přepíšu Konec   → drží Začátek, přepočte se Trvání
//    přepíšu Trvání  → drží Začátek, přepočte se Konec
// ----------------------------------------------------------------------------

export interface TaskDates {
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
}

export function recalcDates(
  current: TaskDates,
  changed: "startDate" | "endDate" | "durationDays",
  value: string | number | null,
): TaskDates {
  const next: TaskDates = { ...current, [changed]: value } as TaskDates;
  const { startDate, endDate, durationDays } = next;

  if (changed === "startDate" && startDate && durationDays) {
    next.endDate = addWorkdays(startDate, durationDays);
  } else if (changed === "endDate" && startDate && endDate) {
    next.durationDays = workdaysBetween(startDate, endDate);
  } else if (changed === "durationDays" && startDate && durationDays) {
    next.endDate = addWorkdays(startDate, durationDays);
  } else if (startDate && endDate && !durationDays) {
    next.durationDays = workdaysBetween(startDate, endDate);
  } else if (startDate && durationDays && !endDate) {
    next.endDate = addWorkdays(startDate, durationDays);
  }
  return next;
}

// ----------------------------------------------------------------------------
//  Kolize (ZADANI.md kap. 9): jakýkoliv vizuální překryv rozpětí na ose člověka.
//  Testuje se úkol × úkol i úkol × absence. Překryv je povolený – jen se hlásí.
// ----------------------------------------------------------------------------

export interface DateRange {
  start: string;
  end: string;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Průnik dvou rozpětí (pro hlášku „co se s čím překrývá a v jakém období"). */
export function rangeIntersection(a: DateRange, b: DateRange): DateRange | null {
  if (!rangesOverlap(a, b)) return null;
  return {
    start: a.start > b.start ? a.start : b.start,
    end: a.end < b.end ? a.end : b.end,
  };
}
