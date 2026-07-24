// Seznam zákazníků s vyhledáváním (1:1 z Popt-vky/app/zakaznici/page.tsx).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ZakazniciTabulka, type ZakaznikRadek } from "@/components/zakaznici/ZakazniciTabulka";

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
  const rows: ZakaznikRadek[] = ((customers ?? []) as unknown as CustomerRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    country: c.country,
    inquiryCount: c.inquiries?.[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zákazníci</h1>
        <Link
          href="/zakaznici/novy"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + Nový zákazník
        </Link>
      </div>

      <ZakazniciTabulka rows={rows} />
    </div>
  );
}
