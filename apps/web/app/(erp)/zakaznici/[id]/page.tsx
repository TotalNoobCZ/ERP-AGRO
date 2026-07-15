// Detail/úprava zákazníka (1:1 z Popt-vky/app/zakaznici/[id]/page.tsx).
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CustomerForm, ContactsManager } from "@/components/poptavky/customer-forms";
import { StatusBadge } from "@/components/poptavky/badges";
import { formatDate } from "@/lib/format";
import type { InquiryStatus } from "@erp/core";

export const dynamic = "force-dynamic";

type CustomerDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  contacts: { id: string; name: string; phone: string | null; email: string | null; created_at: string }[];
  inquiries: { id: string; number: number; subject: string; status: string; received_at: string; person: { name: string } | null }[];
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("customers")
    .select(
      `id, name, email, phone, address, country,
       contacts(id, name, phone, email, created_at),
       inquiries(id, number, subject, status, received_at, person:profiles(name))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const customer = data as unknown as CustomerDetail;

  const contacts = [...(customer.contacts ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const inquiries = [...(customer.inquiries ?? [])].sort((a, b) => b.number - a.number);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Úprava zákazníka</h1>

      <Card>
        <CardHeader><CardTitle>Údaje</CardTitle></CardHeader>
        <CardContent>
          <CustomerForm
            customer={{
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              country: customer.country,
            }}
            inquiryCount={inquiries.length}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kontaktní osoby</CardTitle></CardHeader>
        <CardContent>
          <ContactsManager customerId={customer.id} initial={contacts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Poptávky zákazníka ({inquiries.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {inquiries.length === 0 && (
            <p className="text-sm text-muted-foreground">Žádné poptávky.</p>
          )}
          {inquiries.map((inq) => (
            <Link
              key={inq.id}
              href={`/poptavky/${inq.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">#{inq.number} · {inq.subject}</p>
                <p className="text-sm text-muted-foreground">
                  {inq.person?.name ?? "—"} · přijato {formatDate(inq.received_at)}
                </p>
              </div>
              <StatusBadge status={inq.status as InquiryStatus} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
