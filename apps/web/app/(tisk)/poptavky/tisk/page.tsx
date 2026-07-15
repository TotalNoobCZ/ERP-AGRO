// Tiskový export seznamu poptávek – stejná filtrovací logika jako seznam.
import { createClient } from "@/lib/supabase/server";
import { queryInquiries, type InquiryListParams } from "@/lib/poptavky-query";
import { PrintButton } from "@/components/poptavky/print-button";
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from "@erp/core";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InquiriesPrintPage({
  searchParams,
}: {
  searchParams: Promise<InquiryListParams & { print?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const inquiries = await queryInquiries(supabase, { ...params, sort: params.sort ?? "number" });

  return (
    <div className="mx-auto max-w-5xl bg-white p-8 text-black">
      <PrintButton auto={params.print === "1"} />

      <div className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold">Seznam poptávek</h1>
        <p className="text-sm text-gray-500">
          Počet záznamů: {inquiries.length} · vytištěno {formatDate(new Date())}
        </p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-gray-400 text-left">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Předmět</th>
            <th className="py-1 pr-2">Zákazník</th>
            <th className="py-1 pr-2">Osoba</th>
            <th className="py-1 pr-2">Přijato</th>
            <th className="py-1 pr-2">Stav</th>
            <th className="py-1 pr-2">Termín</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inq) => (
            <tr key={inq.id} className="break-inside-avoid border-b border-gray-200 align-top">
              <td className="py-1 pr-2">#{inq.number}</td>
              <td className="py-1 pr-2">{inq.subject}</td>
              <td className="py-1 pr-2">
                <div>{inq.customer?.name ?? "—"}</div>
                {inq.contact_name && (
                  <div className="text-[10px] text-gray-500">{inq.contact_name}</div>
                )}
              </td>
              <td className="py-1 pr-2">{inq.person?.name ?? "—"}</td>
              <td className="whitespace-nowrap py-1 pr-2">{formatDate(inq.received_at)}</td>
              <td className="whitespace-nowrap py-1 pr-2">
                {INQUIRY_STATUS_LABELS[inq.status as InquiryStatus]}
              </td>
              <td className="whitespace-nowrap py-1 pr-2">
                {inq.deadline ? formatDate(inq.deadline) : "—"}
              </td>
            </tr>
          ))}
          {inquiries.length === 0 && (
            <tr><td colSpan={7} className="py-4 text-center text-gray-500">Žádné poptávky.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
