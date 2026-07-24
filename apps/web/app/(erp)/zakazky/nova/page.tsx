// Nová akce – port z Planovani + integrace: předvyplnění z poptávky (?inquiry=).
import { createClient } from "@/lib/supabase/server";
import ZakazkaForm, { type InquiryOrigin } from "@/components/zakazky/ZakazkaForm";
import type { OsobaLite } from "@/components/zakazky/common";

export const dynamic = "force-dynamic";

export default async function NovaZakazkaPage({
  searchParams,
}: {
  searchParams: Promise<{ inquiry?: string; parent?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Přiřaditelné osoby (assignable) = pracovníci na akci.
  // Odpovědná osoba = Kancelář / Projekťák / role Vedoucí.
  const [{ data: osoby }, { data: odpovedni }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, oddeleni")
      .eq("active", true)
      .eq("assignable", true)
      .order("oddeleni", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, name, oddeleni")
      .eq("active", true)
      .or("oddeleni.eq.projektak,role.eq.vedouci")
      .order("name", { ascending: true }),
  ]);

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

  // Hlavní akce (tok: zakládám podzakázku z detailu zakázky).
  let parent: { id: string; kod: string } | null = null;
  if (sp.parent) {
    const { data } = await supabase
      .from("zakazky")
      .select("id, kod")
      .eq("id", sp.parent)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) parent = { id: data.id, kod: data.kod };
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{parent ? "Nová zakázka k akci" : "Nová akce"}</h1>
      <ZakazkaForm
        osoby={(osoby ?? []) as OsobaLite[]}
        odpovedni={(odpovedni ?? []) as OsobaLite[]}
        inquiry={inquiry}
        parent={parent}
      />
    </div>
  );
}
