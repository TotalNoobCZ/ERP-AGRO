// Dashboard modulu Poptávky (1:1 z Popt-vky/app/dashboard/page.tsx).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, DeadlineBadge } from "@/components/poptavky/badges";
import {
  INQUIRY_STATUS_ORDER,
  INQUIRY_STATUS_LABELS,
  INQUIRY_CLOSED_STATUSES,
  type InquiryStatus,
} from "@erp/core";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  number: number;
  subject: string;
  status: InquiryStatus;
  deadline: string | null;
  customer: { name: string } | null;
  person: { name: string } | null;
};

const ROW_SELECT =
  "id, number, subject, status, deadline, customer:customers(name), person:profiles(name)";

function InquiryRow({ inq }: { inq: Row }) {
  return (
    <Link
      href={`/poptavky/${inq.id}`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">#{inq.number} · {inq.subject}</p>
        <p className="text-sm text-muted-foreground">
          {inq.customer?.name ?? "—"} · {inq.person?.name ?? "—"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={inq.status} />
        <DeadlineBadge deadline={inq.deadline} />
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const closed = `(${INQUIRY_CLOSED_STATUSES.join(",")})`;

  // Všechny dotazy paralelně – rychlejší načtení.
  const [statusRows, overdueCount, upcoming, overdue, contactCount, toContact] = await Promise.all([
    supabase.from("inquiries").select("status"),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .lt("deadline", now)
      .not("status", "in", closed),
    supabase
      .from("inquiries")
      .select(ROW_SELECT)
      .not("status", "in", closed)
      .gte("deadline", now)
      .order("deadline", { ascending: true })
      .limit(5),
    supabase
      .from("inquiries")
      .select(ROW_SELECT)
      .not("status", "in", closed)
      .lt("deadline", now)
      .order("deadline", { ascending: true })
      .limit(5),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("needs_contact", true),
    supabase
      .from("inquiries")
      .select(ROW_SELECT)
      .eq("needs_contact", true)
      .order("number", { ascending: false })
      .limit(5),
  ]);

  // Počty podle stavu (Prisma groupBy → spočtení v JS).
  const counts: Record<string, number> = {};
  for (const r of statusRows.data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const nOverdue = overdueCount.count ?? 0;
  const nContact = contactCount.count ?? 0;
  const upcomingRows = (upcoming.data ?? []) as unknown as Row[];
  const overdueRows = (overdue.data ?? []) as unknown as Row[];
  const toContactRows = (toContact.data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Karty s počty podle stavu – prokliknutelné na filtrovaný seznam */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
        <Link href="/poptavky">
          <Card className="transition-colors hover:bg-accent">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Celkem</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">{total}</p>
            </CardContent>
          </Card>
        </Link>
        {INQUIRY_STATUS_ORDER.map((s) => (
          <Link key={s} href={`/poptavky?status=${s}`}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {INQUIRY_STATUS_LABELS[s]}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{counts[s] ?? 0}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Nejbližší termíny */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">📅 Nejbližší termíny</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcomingRows.length === 0 && (
            <p className="text-sm text-muted-foreground">Žádné nadcházející termíny.</p>
          )}
          {upcomingRows.map((inq) => <InquiryRow key={inq.id} inq={inq} />)}
        </CardContent>
      </Card>

      {/* Po termínu */}
      <Card className={nOverdue > 0 ? "border-red-400/50" : ""}>
        <CardHeader>
          <Link href="/poptavky?deadline=overdue" className="flex items-center justify-between gap-2 hover:underline">
            <CardTitle className="flex items-center gap-2">
              <span className={nOverdue > 0 ? "text-red-400" : "text-muted-foreground"}>⚠️</span>
              Po termínu: {nOverdue}
            </CardTitle>
            <span className="flex items-center text-sm text-muted-foreground">zobrazit všechny ›</span>
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {overdueRows.length === 0 && (
            <p className="text-sm text-muted-foreground">Žádné poptávky po termínu. 👍</p>
          )}
          {overdueRows.map((inq) => <InquiryRow key={inq.id} inq={inq} />)}
          {nOverdue > overdueRows.length && (
            <Link href="/poptavky?deadline=overdue" className="block pt-1 text-sm text-red-400 hover:underline">
              … a dalších {nOverdue - overdueRows.length} – zobrazit všechny
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Ke kontaktování */}
      <Card className={nContact > 0 ? "border-orange-400/50" : ""}>
        <CardHeader>
          <Link href="/poptavky?contact=1" className="flex items-center justify-between gap-2 hover:underline">
            <CardTitle className="flex items-center gap-2">
              <span className={nContact > 0 ? "text-orange-400" : "text-muted-foreground"}>📞</span>
              Ke kontaktování: {nContact}
            </CardTitle>
            <span className="flex items-center text-sm text-muted-foreground">zobrazit všechny ›</span>
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {toContactRows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nikoho není potřeba kontaktovat. 👍</p>
          )}
          {toContactRows.map((inq) => <InquiryRow key={inq.id} inq={inq} />)}
          {nContact > toContactRows.length && (
            <Link href="/poptavky?contact=1" className="block pt-1 text-sm text-orange-400 hover:underline">
              … a dalších {nContact - toContactRows.length} – zobrazit všechny
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
