// Tiskový export detailu poptávky (1:1 z Popt-vky/app/poptavky/[id]/tisk).
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/poptavky/print-button";
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from "@erp/core";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type PrintDetail = {
  id: string;
  number: number;
  subject: string;
  description: string | null;
  source: string | null;
  status: string;
  deadline: string | null;
  received_at: string;
  customer: { name: string; email: string | null; phone: string | null; address: string | null } | null;
  person: { name: string; email: string } | null;
  comments: { id: string; text: string; author: string; created_at: string }[];
  status_logs: { id: string; from_status: string | null; to_status: string; changed_by: string; created_at: string }[];
};

export default async function InquiryPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("inquiries")
    .select(
      `id, number, subject, description, source, status, deadline, received_at,
       customer:customers(name, email, phone, address),
       person:profiles(name, email),
       comments(id, text, author, created_at),
       status_logs(id, from_status, to_status, changed_by, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const inquiry = data as unknown as PrintDetail;

  const comments = [...(inquiry.comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const statusLogs = [...(inquiry.status_logs ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black">
      <PrintButton auto={sp?.print === "1"} />

      <div className="mb-6 border-b border-gray-300 pb-4">
        <p className="text-sm text-gray-500">Poptávka #{inquiry.number}</p>
        <h1 className="text-2xl font-bold">{inquiry.subject}</h1>
        <p className="mt-1 text-sm">
          Stav: <strong>{INQUIRY_STATUS_LABELS[inquiry.status as InquiryStatus]}</strong>
        </p>
      </div>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-lg font-semibold">Informace</h2>
        <table className="w-full text-sm">
          <tbody>
            <PrintRow label="Předmět" value={inquiry.subject} />
            <PrintRow label="Popis" value={inquiry.description || "—"} />
            <PrintRow label="Druh poptávky" value={inquiry.source || "—"} />
            <PrintRow label="Datum přijetí" value={formatDate(inquiry.received_at)} />
            <PrintRow label="Termín nabídky" value={inquiry.deadline ? formatDate(inquiry.deadline) : "bez termínu"} />
            <PrintRow
              label="Odpovědná osoba"
              value={inquiry.person ? `${inquiry.person.name} (${inquiry.person.email})` : "—"}
            />
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-lg font-semibold">Zákazník</h2>
        <table className="w-full text-sm">
          <tbody>
            <PrintRow label="Název / jméno" value={inquiry.customer?.name ?? "—"} />
            <PrintRow label="E-mail" value={inquiry.customer?.email || "—"} />
            <PrintRow label="Telefon" value={inquiry.customer?.phone || "—"} />
            <PrintRow label="Adresa" value={inquiry.customer?.address || "—"} />
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-lg font-semibold">Historie stavů</h2>
        {statusLogs.length === 0 ? (
          <p className="text-sm text-gray-500">Žádné záznamy.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {statusLogs.map((log) => (
              <li key={log.id} className="border-l-2 border-gray-300 pl-3">
                {log.from_status
                  ? `${INQUIRY_STATUS_LABELS[log.from_status as InquiryStatus]} → ${INQUIRY_STATUS_LABELS[log.to_status as InquiryStatus]}`
                  : `Vytvořeno (${INQUIRY_STATUS_LABELS[log.to_status as InquiryStatus]})`}
                <span className="text-gray-500"> — {log.changed_by}, {formatDateTime(log.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Poznámky</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500">Žádné poznámky.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {comments.map((c) => (
              <li key={c.id} className="break-inside-avoid rounded border border-gray-200 p-2">
                <p className="whitespace-pre-wrap">{c.text}</p>
                <p className="mt-1 text-xs text-gray-500">{c.author} · {formatDateTime(c.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-gray-400">
        Vytištěno {formatDateTime(new Date())} · Evidence poptávek
      </p>
    </div>
  );
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="w-40 py-1 align-top text-gray-500">{label}</td>
      <td className="py-1 align-top font-medium">{value}</td>
    </tr>
  );
}
