// ----------------------------------------------------------------------------
//  Formátování dat a logika termínů. Jednotné české formátování napříč ERP.
//  - datum: "15. 7. 2026"  (bez úvodních nul, jak je v CZ zvykem)
//  - datum a čas: "15. 7. 2026 14:30" (časová zóna Europe/Prague)
//  Logika termínů (barvy) převzata z Popt-vky/lib/utils.ts.
// ----------------------------------------------------------------------------

const TZ = "Europe/Prague";

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

/**
 * Datum čistě z „YYYY-MM-DD" řetězce (sloupce typu date) → "15. 7. 2026".
 * Parsuje se ručně, aby nedošlo k posunu dne kvůli časové zóně.
 */
export function formatDen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d}. ${m}. ${y}`;
}

/** Datum z timestampu (Date/ISO) v české podobě, zóna Europe/Prague. */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("cs-CZ", { timeZone: TZ, day: "numeric", month: "numeric", year: "numeric" });
}

/** Datum a čas z timestampu, zóna Europe/Prague → "15. 7. 2026 14:30". */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("cs-CZ", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
