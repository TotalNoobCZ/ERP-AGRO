// Nová akce – port z Planovani + integrace: předvyplnění z poptávky (?inquiry=).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ZakazkaForm, { type InquiryOrigin } from "@/components/zakazky/ZakazkaForm";
import type { OsobaLite } from "@/components/zakazky/common";

export const dynamic = "force-dynamic";

export default async function NovaZakazkaPage({
  searchParams,
}: {
  searchParams: Promise<{ inquiry?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Přiřaditelné osoby (assignable) – pracovníci i kancelář (jako v originále).
  const { data: osoby } = await supabase
    .from("profiles")
    .select("id, name, oddeleni")
    .eq("active", true)
    .eq("assignable", true)
    .order("oddeleni", { ascending: true })
    .order("name", { ascending: true });

  // Původ z poptávky (tok: poptávka OBJEDNANO → zakázka).
  let inquiry: InquiryOrigin | null = null;
  if (sp.inquiry) {
    const { data } = await supabase
      .from("inquiries")
      .select("id, number, subject, customer:customers(id, name)")
      .eq("id", sp.inquiry)
      .maybeSingle();
    if (data) {
      const cust = data.customer as unknown as { id: string; name: string } | null;
      inquiry = {
        id: data.id,
        number: data.number,
        subject: data.subject,
        customerId: cust?.id ?? null,
        customerName: cust?.name ?? null,
      };
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Nová akce</h1>
      {(osoby ?? []).length === 0 ? (
        <div className="card border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-300">
          Zatím nemáte žádné přiřaditelné osoby a akce vyžaduje alespoň jednoho pracovníka.
          Nejdřív prosím{" "}
          <Link href="/sprava/novy" className="font-medium underline">přidejte osobu</Link>{" "}
          ve Správě (a zaškrtněte „lze přiřazovat"), pak se sem vraťte.
        </div>
      ) : (
        <ZakazkaForm osoby={(osoby ?? []) as OsobaLite[]} inquiry={inquiry} />
      )}
    </div>
  );
}
