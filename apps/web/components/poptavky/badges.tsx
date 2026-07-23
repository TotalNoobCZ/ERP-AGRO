// Barevné štítky stavu a termínu. Převzato z Popt-vky (status-badge.tsx,
// deadline-badge.tsx) – barvy 1:1, světlé pilulky fungují i na tmavém pozadí.
import { Badge } from "@/components/ui";
import { INQUIRY_STATUS_LABELS, inquiryDeadlineActive, type InquiryStatus } from "@erp/core";
import { deadlineLevel, daysUntil, formatDate } from "@/lib/format";

export const STATUS_STYLES: Record<InquiryStatus, string> = {
  NOVA: "bg-blue-100 text-blue-800 border-blue-200",
  V_JEDNANI: "bg-amber-100 text-amber-800 border-amber-200",
  ODESLANA: "bg-green-700 text-white border-green-800",
  NEREAGUJE: "bg-orange-100 text-orange-800 border-orange-200",
  ODLOZENO: "bg-purple-100 text-purple-800 border-purple-200",
  OBJEDNANO: "bg-green-100 text-green-800 border-green-200",
  ZAMITNUTO: "bg-red-100 text-red-800 border-red-200",
};

export function StatusBadge({ status }: { status: InquiryStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{INQUIRY_STATUS_LABELS[status]}</Badge>;
}

const DEADLINE_STYLES = {
  green: "bg-green-100 text-green-800 border-green-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  red: "bg-red-100 text-red-800 border-red-200",
};

export function DeadlineBadge({
  deadline,
  status,
}: {
  deadline: Date | string | null;
  /** Stav poptávky – po odeslání nabídky se „po termínu" už nehlásí. */
  status?: InquiryStatus;
}) {
  if (!deadline) {
    return <Badge className="border-gray-200 bg-gray-100 text-gray-500">bez termínu</Badge>;
  }
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  // Nabídka už odeslána / vyřízeno → lhůta splněna, jen ukážeme datum.
  if (status && !inquiryDeadlineActive(status)) {
    return (
      <Badge
        className="border-gray-200 bg-gray-100 text-gray-500"
        title="Termín splněn – nabídka už byla odeslána/vyřízena"
      >
        {formatDate(d)}
      </Badge>
    );
  }
  const level = deadlineLevel(d);
  const days = daysUntil(d);
  const note =
    days < 0 ? `po termínu o ${Math.abs(days)} d` : days === 0 ? "dnes" : `za ${days} d`;
  return (
    <Badge className={DEADLINE_STYLES[level]}>
      {formatDate(d)} · {note}
    </Badge>
  );
}
