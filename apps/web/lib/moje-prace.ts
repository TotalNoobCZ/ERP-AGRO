// ----------------------------------------------------------------------------
//  Data pro osobní rozcestník „Moje práce" – co čeká přihlášeného uživatele
//  napříč moduly (poptávky, zakázky). Slouží k rychlé orientaci na úvodu.
// ----------------------------------------------------------------------------
import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { InquiryStatus } from "@erp/core";

export type MojePoptavka = {
  id: string;
  number: number;
  subject: string;
  status: InquiryStatus;
  deadline: string | null;
  needsContact: boolean;
  customerName: string;
};

/** Otevřené poptávky, za které uživatel odpovídá (dle termínu). */
export async function queryMojePoptavky(
  supabase: Awaited<ReturnType<typeof createClient>>,
  personId: string,
): Promise<MojePoptavka[]> {
  const { data } = await supabase
    .from("inquiries")
    .select("id, number, subject, status, deadline, needs_contact, customer:customers(name)")
    .eq("person_id", personId)
    .not("status", "in", "(OBJEDNANO,ODLOZENO,ZAMITNUTO)")
    .order("deadline", { ascending: true, nullsFirst: false });
  return (data ?? []).map((p) => {
    const cust = p.customer as { name: string } | { name: string }[] | null;
    const customerName = Array.isArray(cust) ? cust[0]?.name ?? "—" : cust?.name ?? "—";
    return {
      id: p.id,
      number: p.number,
      subject: p.subject,
      status: p.status as InquiryStatus,
      deadline: p.deadline,
      needsContact: p.needs_contact,
      customerName,
    };
  });
}

export type MojeZakazka = {
  id: string;
  kod: string;
  mistoPlneni: string;
  popis: string | null;
  konecAktualni: string;
  stav: string;
  role: "odpovědná osoba" | "pracovník";
};

/** Aktivní zakázky, kde je uživatel odpovědná osoba nebo přiřazený pracovník. */
export async function queryMojeZakazky(
  supabase: Awaited<ReturnType<typeof createClient>>,
  personId: string,
): Promise<MojeZakazka[]> {
  const [odpRes, prRes] = await Promise.all([
    supabase
      .from("zakazky")
      .select("id, kod, misto_plneni, popis, konec_aktualni, stav")
      .eq("odpovedna_osoba_id", personId)
      .is("deleted_at", null)
      .in("stav", ["AKTIVNI", "POZASTAVENO"]),
    supabase
      .from("prirazeni_zakazka")
      .select("zakazka:zakazky(id, kod, misto_plneni, popis, konec_aktualni, stav, deleted_at)")
      .eq("osoba_id", personId)
      .is("deleted_at", null),
  ]);

  const map = new Map<string, MojeZakazka>();
  for (const z of odpRes.data ?? []) {
    map.set(z.id, {
      id: z.id,
      kod: z.kod,
      mistoPlneni: z.misto_plneni,
      popis: z.popis,
      konecAktualni: z.konec_aktualni,
      stav: z.stav,
      role: "odpovědná osoba",
    });
  }
  for (const row of prRes.data ?? []) {
    const z = (row as { zakazka: unknown }).zakazka as
      | { id: string; kod: string; misto_plneni: string; popis: string | null; konec_aktualni: string; stav: string; deleted_at: string | null }
      | null;
    if (!z || z.deleted_at || !["AKTIVNI", "POZASTAVENO"].includes(z.stav)) continue;
    if (map.has(z.id)) continue; // odpovědná osoba má přednost
    map.set(z.id, {
      id: z.id,
      kod: z.kod,
      mistoPlneni: z.misto_plneni,
      popis: z.popis,
      konecAktualni: z.konec_aktualni,
      stav: z.stav,
      role: "pracovník",
    });
  }
  return [...map.values()].sort((a, b) => a.konecAktualni.localeCompare(b.konecAktualni));
}
