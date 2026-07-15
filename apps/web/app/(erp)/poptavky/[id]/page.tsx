// Detail poptávky (1:1 z Popt-vky/app/poptavky/[id]/page.tsx).
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryPersons } from "@/lib/poptavky-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, DeadlineBadge } from "@/components/poptavky/badges";
import {
  StatusChanger,
  ContactToggle,
  CommentForm,
  DeleteInquiryButton,
} from "@/components/poptavky/status-changer";
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from "@erp/core";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/countries";

export const dynamic = "force-dynamic";

// Tvar výsledku s vnořenými entitami (ruční typ – viz packages/db, embedy
// nejsou v ručně psaném Database typu odvoditelné).
type InquiryDetail = {
  id: string;
  number: number;
  subject: string;
  description: string | null;
  source: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  deadline: string | null;
  received_at: string;
  needs_contact: boolean;
  customer: { id: string; name: string; email: string | null; phone: string | null; address: string | null; country: string | null } | null;
  person: { id: string; name: string; email: string } | null;
  comments: { id: string; text: string; author: string; created_at: string }[];
  status_logs: { id: string; from_status: string | null; to_status: string; changed_by: string; note: string | null; created_at: string }[];
};

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Poptávka se vším navázaným najednou (zákazník, osoba, komentáře, historie).
  const { data } = await supabase
    .from("inquiries")
    .select(
      `id, number, subject, description, source, contact_name, contact_phone, contact_email,
       status, deadline, received_at, needs_contact,
       customer:customers(id, name, email, phone, address, country),
       person:profiles(id, name, email),
       comments(id, text, author, created_at),
       status_logs(id, from_status, to_status, changed_by, note, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const inquiry = data as unknown as InquiryDetail;

  const [persons, profile] = await Promise.all([queryPersons(supabase), getCurrentProfile()]);
  const defaultAuthor = profile?.name ?? "";

  // Tok mezi moduly: existuje už zakázka založená z této poptávky?
  const { data: zakazkaZPoptavky } = await supabase
    .from("zakazky")
    .select("id, kod")
    .eq("inquiry_id", inquiry.id)
    .is("deleted_at", null)
    .maybeSingle();

  const comments = [...(inquiry.comments ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const statusLogs = [...(inquiry.status_logs ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const customer = inquiry.customer;
  const person = inquiry.person;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        href="/poptavky"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-text"
      >
        ← Zpět na seznam poptávek
      </Link>

      {/* Hlavička s akcemi */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Poptávka #{inquiry.number}</p>
          <h1 className="text-2xl font-bold">{inquiry.subject}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={inquiry.status as InquiryStatus} />
            <DeadlineBadge deadline={inquiry.deadline} />
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/poptavky/${inquiry.id}/tisk?print=1`}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-input px-3 text-xs font-medium hover:bg-accent"
          >
            🖨 Export do PDF
          </Link>
          <Link
            href={`/poptavky/${inquiry.id}/upravit`}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-input px-3 text-xs font-medium hover:bg-accent"
          >
            ✏️ Upravit
          </Link>
          <DeleteInquiryButton inquiryId={inquiry.id} />
        </div>
      </div>

      {/* Tok mezi moduly: poptávka OBJEDNANO ⇄ zakázka */}
      {inquiry.status === "OBJEDNANO" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-user-1/40 bg-user-1/10 p-3 text-sm">
          {zakazkaZPoptavky ? (
            <span>
              Z této poptávky vznikla zakázka{" "}
              <Link href={`/zakazky/${zakazkaZPoptavky.id}`} className="font-mono font-semibold text-link hover:underline">
                {zakazkaZPoptavky.kod}
              </Link>
              .
            </span>
          ) : (
            <>
              <span>Poptávka je objednaná — je čas založit výrobní zakázku.</span>
              <Link
                href={`/zakazky/nova?inquiry=${inquiry.id}`}
                className="rounded-md bg-user-1 px-3 py-1.5 font-semibold text-on-accent hover:opacity-90"
              >
                Vytvořit zakázku
              </Link>
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Levý sloupec – informace */}
        <div className="space-y-4 md:col-span-2">
          <Card>
            <CardHeader><CardTitle>Informace</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="ID poptávky" value={`#${inquiry.number}`} />
              <Row label="Předmět" value={inquiry.subject} />
              <Row label="Popis" value={inquiry.description || "—"} />
              <Row label="Druh poptávky" value={inquiry.source || "—"} />
              <Row label="Kontaktní osoba" value={inquiry.contact_name || "—"} />
              <Row label="Telefon kontaktu" value={inquiry.contact_phone ? formatPhone(inquiry.contact_phone) : "—"} />
              <Row label="E-mail kontaktu" value={inquiry.contact_email || "—"} />
              <Row label="Datum přijetí" value={formatDate(inquiry.received_at)} />
              <Row label="Termín nabídky" value={inquiry.deadline ? formatDate(inquiry.deadline) : "—"} />
              <Row label="Odpovědná osoba" value={person ? `${person.name} (${person.email})` : "—"} />
            </CardContent>
          </Card>

          {/* Změna stavu */}
          <Card>
            <CardHeader><CardTitle>Stav poptávky</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <StatusChanger
                inquiryId={inquiry.id}
                current={inquiry.status as InquiryStatus}
                persons={persons}
                defaultAuthor={defaultAuthor}
              />
              <ContactToggle inquiryId={inquiry.id} initial={inquiry.needs_contact} />
            </CardContent>
          </Card>

          {/* Poznámky */}
          <Card>
            <CardHeader><CardTitle>Poznámky</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <CommentForm inquiryId={inquiry.id} persons={persons} defaultAuthor={defaultAuthor} />
              <div className="space-y-2">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">Zatím žádné poznámky.</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <p className="whitespace-pre-wrap text-sm">{c.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.author} · {formatDateTime(c.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pravý sloupec – zákazník + historie */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Zákazník</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="font-medium">{customer?.name ?? "—"}</p>
              {customer?.email && (
                <p className="flex items-center gap-2 text-muted-foreground">✉️ {customer.email}</p>
              )}
              {customer?.phone && (
                <p className="flex items-center gap-2 text-muted-foreground">📞 {formatPhone(customer.phone)}</p>
              )}
              {customer?.address && (
                <p className="flex items-center gap-2 text-muted-foreground">📍 {customer.address}</p>
              )}
              {customer?.country && (
                <p className="flex items-center gap-2 text-muted-foreground">🌍 {customer.country}</p>
              )}
            </CardContent>
          </Card>

          {/* Historie změn stavu */}
          <Card>
            <CardHeader><CardTitle>Historie stavů</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {statusLogs.map((log) => (
                <div key={log.id} className="border-l-2 border-muted pl-3 text-sm">
                  <p>
                    {log.from_status
                      ? `${INQUIRY_STATUS_LABELS[log.from_status as InquiryStatus]} → ${INQUIRY_STATUS_LABELS[log.to_status as InquiryStatus]}`
                      : `Vytvořeno (${INQUIRY_STATUS_LABELS[log.to_status as InquiryStatus]})`}
                  </p>
                  {log.note && <p className="mt-0.5 text-sm">Důvod: {log.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {log.changed_by} · {formatDateTime(log.created_at)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
