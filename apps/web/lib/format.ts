// ----------------------------------------------------------------------------
//  Formátování dat a logika termínů. Převzato 1:1 z Popt-vky/lib/utils.ts –
//  jediný zdroj pravdy pro barevné rozlišení termínů (zelená/oranžová/červená).
// ----------------------------------------------------------------------------

export type DeadlineLevel = "green" | "orange" | "red";

/** Počet dní, kdy termín považujeme za "blížící se" (oranžová). */
export const REMINDER_DAYS_BEFORE = Number(process.env.REMINDER_DAYS_BEFORE ?? 3);

/** Počet celých dní mezi dneškem (00:00) a termínem. Záporné = po termínu. */
export function daysUntil(deadline: Date, now: Date = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Zařadí termín do barevné kategorie. */
export function deadlineLevel(deadline: Date, now: Date = new Date()): DeadlineLevel {
  const d = daysUntil(deadline, now);
  if (d < 0) return "red";
  if (d <= REMINDER_DAYS_BEFORE) return "orange";
  return "green";
}

/** Formátování data do českého tvaru DD.MM.YYYY. */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Formátování data a času. */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
