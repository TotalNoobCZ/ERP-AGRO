// Práce s datem na úrovni dnů, bez časových zón.
// V DB je @db.Date; v JS pracujeme s Date v UTC půlnoci, ať se nic neposouvá.

/** "YYYY-MM-DD" -> Date (UTC půlnoc). */
export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/** Date -> "YYYY-MM-DD". */
export function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dnešní den jako UTC půlnoc. */
export function today(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Den o `n` dní vedle (n může být záporné). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function dayBefore(d: Date): Date {
  return addDays(d, -1);
}

/** Formátování pro zobrazení, např. 5. 5. 2026. */
export function formatCz(d: Date): string {
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

/** První a poslední den měsíce, do kterého datum spadá. */
export function monthRange(d: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { from, to };
}
