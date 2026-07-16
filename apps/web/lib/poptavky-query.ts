// ----------------------------------------------------------------------------
//  Sdílená dotazová logika seznamu poptávek (tabulka + tiskový export).
//  Přepis WHERE/ORDER BY logiky z Popt-vky/app/poptavky/page.tsx na supabase-js.
// ----------------------------------------------------------------------------
import { INQUIRY_STATUSES, INQUIRY_CLOSED_STATUSES, type InquiryStatus } from "@erp/core";
import type { createClient } from "@/lib/supabase/server";

export type InquiryListParams = {
  q?: string;
  status?: string;
  personId?: string;
  deadline?: string;
  contact?: string;
  sort?: string;
};

export type InquiryListRow = {
  id: string;
  number: number;
  subject: string;
  description: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  received_at: string;
  status: InquiryStatus;
  deadline: string | null;
  needs_contact: boolean;
  customer: { name: string } | null;
  person: { name: string } | null;
};

export async function queryInquiries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: InquiryListParams,
): Promise<InquiryListRow[]> {
  const { q, status, personId, deadline, contact, sort = "number_desc" } = params;

  let query = supabase
    .from("inquiries")
    .select(
      "id, number, subject, description, contact_name, contact_phone, contact_email, received_at, status, deadline, needs_contact, customer:customers(name), person:profiles(name)",
    );

  // Fulltext: předmět, popis a jméno zákazníka. Jméno zákazníka je přes join –
  // nejdřív najdeme odpovídající customer_id, pak OR přes tři podmínky.
  if (q) {
    const like = `%${q}%`;
    const { data: matchingCustomers } = await supabase
      .from("customers")
      .select("id")
      .ilike("name", like);
    const ids = (matchingCustomers ?? []).map((c) => c.id);
    const orParts = [`subject.ilike.${like}`, `description.ilike.${like}`];
    if (ids.length > 0) orParts.push(`customer_id.in.(${ids.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const now = new Date().toISOString();

  if (status && INQUIRY_STATUSES.includes(status as InquiryStatus)) {
    // Explicitně vybraný stav má přednost.
    query = query.eq("status", status as InquiryStatus);
  } else if (deadline === "overdue") {
    // Pohled "po termínu" = jen živé (neuzavřené) poptávky.
    query = query.not("status", "in", `(${INQUIRY_CLOSED_STATUSES.join(",")})`);
  } else if (contact === "1") {
    // Pohled "ke kontaktování" – stav neomezujeme.
  } else {
    // Hlavní seznam NEzobrazuje "Objednáno" – mají vlastní záložku.
    query = query.neq("status", "OBJEDNANO");
  }
  if (personId) query = query.eq("person_id", personId);
  if (contact === "1") query = query.eq("needs_contact", true);

  if (deadline === "overdue") query = query.lt("deadline", now);
  else if (deadline === "upcoming") query = query.gte("deadline", now);

  // Řazení (stejné volby jako v originále).
  if (sort === "number_desc") query = query.order("number", { ascending: false });
  else if (sort === "deadline") query = query.order("deadline", { ascending: true });
  else if (sort === "deadline_desc") query = query.order("deadline", { ascending: false });
  else if (sort === "received_desc") query = query.order("received_at", { ascending: false });
  else if (sort === "received") query = query.order("received_at", { ascending: true });
  else query = query.order("number", { ascending: true });

  const { data } = await query;
  return (data ?? []) as unknown as InquiryListRow[];
}

/** Číselník osob pro filtry a autora = aktivní profily. */
export async function queryPersons(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("active", true)
    .order("name", { ascending: true });
  return data ?? [];
}

/**
 * Osoby, které smí být odpovědné za poptávku = role Vedoucí NEBO oddělení
 * Projekťák. `includeId` navíc přidá už přiřazenou osobu, i kdyby dnes
 * pravidlo nesplňovala (aby se v editaci neztratila).
 */
export async function queryResponsibles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  includeId?: string | null,
) {
  const { data } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("active", true)
    .or("role.eq.vedouci,oddeleni.eq.projektak")
    .order("name", { ascending: true });
  const list = data ?? [];

  if (includeId && !list.some((p) => p.id === includeId)) {
    const { data: current } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", includeId)
      .maybeSingle();
    if (current) list.push(current);
  }
  return list;
}

// ---------- Tabule poptávek (drag & drop přiřazení) ----------

export type BoardOsoba = { id: string; name: string; colorIndex: number | null };
export type BoardPoptavka = {
  id: string;
  number: number;
  subject: string;
  status: InquiryStatus;
  deadline: string | null;
  personId: string | null;
  customerName: string;
};

/** Data pro tabuli poptávek: odpovědné osoby (dlaždice) + otevřené poptávky. */
export async function queryPoptavkyBoard(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ osoby: BoardOsoba[]; poptavky: BoardPoptavka[] }> {
  const [osobyRes, poptRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, color_index")
      .eq("active", true)
      .or("role.eq.vedouci,oddeleni.eq.projektak")
      .order("name", { ascending: true }),
    // Jen otevřené poptávky (uzavřené se nepřiřazují).
    supabase
      .from("inquiries")
      .select("id, number, subject, status, deadline, person_id, customer:customers(name)")
      .not("status", "in", `(${INQUIRY_CLOSED_STATUSES.join(",")})`)
      .order("number", { ascending: false }),
  ]);

  const osoby: BoardOsoba[] = (osobyRes.data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    colorIndex: o.color_index,
  }));

  const poptavky: BoardPoptavka[] = (poptRes.data ?? []).map((p) => {
    const cust = p.customer as { name: string } | { name: string }[] | null;
    const customerName = Array.isArray(cust) ? cust[0]?.name ?? "—" : cust?.name ?? "—";
    return {
      id: p.id,
      number: p.number,
      subject: p.subject,
      status: p.status as InquiryStatus,
      deadline: p.deadline,
      personId: p.person_id,
      customerName,
    };
  });

  return { osoby, poptavky };
}
