// Seznam zákazníků (1:1 z Popt-vky/app/zakaznici/page.tsx).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { formatPhone } from "@/lib/countries";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = await createClient();
  // Zákazníci včetně počtu poptávek, seřazení podle názvu.
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, email, phone, country, inquiries(count)")
    .order("name", { ascending: true });

  type CustomerRow = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    country: string | null;
    inquiries: { count: number }[];
  };
  const rows = ((customers ?? []) as unknown as CustomerRow[]).map((c) => ({
    ...c,
    inquiryCount: c.inquiries?.[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zákazníci</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{rows.length} záznamů</span>
          <Link
            href="/zakaznici/novy"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + Nový zákazník
          </Link>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Název</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Stát</TableHead>
              <TableHead className="text-center">Poptávek</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Zatím žádní zákazníci.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/zakaznici/${c.id}`} className="hover:underline">{c.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.email ? <span className="flex items-center gap-1.5">✉️ {c.email}</span> : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.phone ? <span className="flex items-center gap-1.5">📞 {formatPhone(c.phone)}</span> : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.country ? <span className="flex items-center gap-1.5">🌍 {c.country}</span> : "—"}
                </TableCell>
                <TableCell className="text-center">{c.inquiryCount}</TableCell>
                <TableCell>
                  <Link href={`/zakaznici/${c.id}`} className="text-muted-foreground hover:text-text" title="Upravit">
                    ✏️
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
