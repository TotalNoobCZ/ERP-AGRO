// Seznam poptávek s filtry (1:1 z Popt-vky/app/poptavky/page.tsx).
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { queryInquiries, queryFilterPersons, type InquiryListParams } from "@/lib/poptavky-query";
import { InquiryFilters, FilterRestore } from "@/components/poptavky/inquiry-filters";
import { InquiryRow } from "@/components/poptavky/inquiry-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<InquiryListParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [inquiries, persons] = await Promise.all([
    queryInquiries(supabase, params),
    queryFilterPersons(supabase),
  ]);

  // Query string pro tiskový export – zachová aktivní filtry a řazení.
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][],
  ).toString();

  return (
    <div className="space-y-4">
      <FilterRestore />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Poptávky</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{inquiries.length} záznamů</span>
          <Link
            href={`/poptavky/tisk?${exportQuery ? `${exportQuery}&` : ""}print=1`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            🖨 Export do PDF
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <InquiryFilters persons={persons} />
      </Suspense>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Předmět</TableHead>
              <TableHead>Zákazník</TableHead>
              <TableHead>Osoba</TableHead>
              <TableHead>Přijato</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Termín</TableHead>
              <TableHead>Kontakt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inquiries.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Žádné poptávky neodpovídají filtru.
                </TableCell>
              </TableRow>
            )}
            {inquiries.map((inq) => (
              <InquiryRow
                key={inq.id}
                inq={{
                  id: inq.id,
                  number: inq.number,
                  subject: inq.subject,
                  description: inq.description,
                  customerName: inq.customer?.name ?? "—",
                  contactName: inq.contact_name,
                  contactPhone: inq.contact_phone,
                  contactEmail: inq.contact_email,
                  personName: inq.person?.name ?? "—",
                  receivedAt: inq.received_at,
                  status: inq.status,
                  deadline: inq.deadline,
                  needsContact: inq.needs_contact,
                }}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
