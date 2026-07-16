"use server";
// ----------------------------------------------------------------------------
//  Server actions modulu Poptávky. Nahrazují API routes původní aplikace
//  (Popt-vky/app/api/*) – logika 1:1, datová vrstva supabase-js + RLS.
//  Pozn.: Prisma transakce -> sekvenční zápisy (RLS chrání konzistenci rolí,
//  případný osiřelý záznam historie není kritický).
// ----------------------------------------------------------------------------
import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { canWrite, INQUIRY_STATUSES, type InquiryStatus, type Role } from "@erp/core";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

type WriterAuth =
  | { error: string; profile?: undefined }
  | { error?: undefined; profile: { id: string; name: string; role: string } };

/** Ověří přihlášení a právo zápisu; vrací profil, nebo text chyby. */
async function requireWriter(): Promise<WriterAuth> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Nejste přihlášen(a)." };
  if (!canWrite(profile.role as Role)) {
    return { error: "Nemáte oprávnění k zápisu (role „Číst“)." };
  }
  return { profile: { id: profile.id, name: profile.name, role: profile.role } };
}

export type NewCustomerInput = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
};

export type InquiryInput = {
  subject: string;
  description?: string;
  source?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  customerId?: string;
  newCustomer?: NewCustomerInput;
  personId: string;
  deadline?: string; // YYYY-MM-DD
  receivedAt?: string; // YYYY-MM-DD
  author?: string; // kdo zakládá (pro historii)
};

/** Založí nového zákazníka, vrátí jeho id (pomocník pro create/update poptávky). */
async function ensureCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: InquiryInput,
): Promise<string | null> {
  if (input.customerId) return input.customerId;
  if (!input.newCustomer?.name) return null;
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.newCustomer.name,
      email: input.newCustomer.email || null,
      phone: input.newCustomer.phone || null,
      address: input.newCustomer.address || null,
      country: input.newCustomer.country || null,
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}

// POST /api/inquiries → createInquiry
export async function createInquiry(input: InquiryInput): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  if (!input.subject || !input.personId || (!input.customerId && !input.newCustomer?.name)) {
    return { ok: false, error: "Vyplňte předmět, zákazníka a odpovědnou osobu." };
  }

  const supabase = await createClient();
  const customerId = await ensureCustomer(supabase, input);
  if (!customerId) return { ok: false, error: "Zákazníka se nepodařilo uložit." };

  const { data: created, error } = await supabase
    .from("inquiries")
    .insert({
      subject: input.subject,
      description: input.description || null,
      source: input.source || null,
      contact_name: input.contactName || null,
      contact_phone: input.contactPhone || null,
      contact_email: input.contactEmail || null,
      customer_id: customerId,
      person_id: input.personId,
      deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
      received_at: input.receivedAt ? new Date(input.receivedAt).toISOString() : new Date().toISOString(),
      status: "NOVA",
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Poptávku se nepodařilo uložit." };

  // První záznam historie: from_status = null (poptávka teprve vzniká).
  await supabase.from("status_logs").insert({
    inquiry_id: created.id,
    from_status: null,
    to_status: "NOVA",
    changed_by: input.author || auth.profile.name,
  });

  revalidatePath("/poptavky");
  return { ok: true, id: created.id };
}

// PUT /api/inquiries/[id] → updateInquiry
export async function updateInquiry(id: string, input: InquiryInput): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  if (!input.subject || !input.personId || (!input.customerId && !input.newCustomer?.name)) {
    return { ok: false, error: "Chybí povinná pole." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("inquiries")
    .select("deadline, received_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Poptávka nenalezena." };

  const customerId = await ensureCustomer(supabase, input);
  if (!customerId) return { ok: false, error: "Zákazníka se nepodařilo uložit." };

  // Při změně termínu resetujeme příznaky notifikací (chování původní app).
  const newDeadline = input.deadline ? new Date(input.deadline).toISOString() : null;
  const oldTime = existing.deadline ? new Date(existing.deadline).getTime() : null;
  const newTime = newDeadline ? new Date(newDeadline).getTime() : null;
  const deadlineChanged = oldTime !== newTime;

  const { error } = await supabase
    .from("inquiries")
    .update({
      subject: input.subject,
      description: input.description || null,
      source: input.source || null,
      contact_name: input.contactName || null,
      contact_phone: input.contactPhone || null,
      contact_email: input.contactEmail || null,
      customer_id: customerId,
      person_id: input.personId,
      deadline: newDeadline,
      received_at: input.receivedAt
        ? new Date(input.receivedAt).toISOString()
        : existing.received_at,
      ...(deadlineChanged ? { reminder_sent: false, expired_notified: false } : {}),
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Uložení se nezdařilo." };

  revalidatePath("/poptavky");
  revalidatePath(`/poptavky/${id}`);
  return { ok: true, id };
}

/**
 * Přiřadí poptávku odpovědné osobě (drag & drop na tabuli poptávek).
 * Odpovědnou osobou smí být jen role Vedoucí nebo oddělení Projekťák.
 */
export async function priraditPoptavku(id: string, personId: string): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  if (!personId) return { ok: false, error: "Chybí osoba." };

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("profiles")
    .select("role, oddeleni, active")
    .eq("id", personId)
    .maybeSingle();
  if (!person || !person.active) return { ok: false, error: "Osoba nenalezena." };
  if (person.role !== "vedouci" && person.oddeleni !== "projektak") {
    return { ok: false, error: "Odpovědnou osobou může být jen Vedoucí nebo Projekťák." };
  }

  const { error } = await supabase.from("inquiries").update({ person_id: personId }).eq("id", id);
  if (error) return { ok: false, error: "Přiřazení se nezdařilo." };
  revalidatePath("/poptavky");
  revalidatePath("/poptavky/tabule");
  revalidatePath(`/poptavky/${id}`);
  return { ok: true };
}

// DELETE /api/inquiries/[id] → deleteInquiry (kaskádově komentáře a logy – FK)
export async function deleteInquiry(id: string): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").delete().eq("id", id);
  if (error) return { ok: false, error: "Smazání se nezdařilo." };
  revalidatePath("/poptavky");
  return { ok: true };
}

// PATCH /api/inquiries/[id]/status → changeInquiryStatus
export async function changeInquiryStatus(
  id: string,
  status: InquiryStatus,
  author: string,
  note?: string,
): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  if (!INQUIRY_STATUSES.includes(status)) return { ok: false, error: "Neplatný stav." };

  const supabase = await createClient();
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!inquiry) return { ok: false, error: "Poptávka nenalezena." };
  if (inquiry.status === status) return { ok: true }; // beze změny – nezapisujeme

  const { error } = await supabase.from("inquiries").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Změna stavu se nezdařila." };

  await supabase.from("status_logs").insert({
    inquiry_id: id,
    from_status: inquiry.status,
    to_status: status,
    changed_by: author || auth.profile.name,
    note: note?.trim() || null,
  });

  // TODO(krok 5): při přechodu na OBJEDNANO nabídnout založení zakázky
  // (shouldOfferZakazka z @erp/core) – doplní se po přenosu modulu Zakázky.

  revalidatePath(`/poptavky/${id}`);
  revalidatePath("/poptavky");
  return { ok: true };
}

// PATCH /api/inquiries/[id]/contact → setNeedsContact / clearNeedsContact
export async function setNeedsContact(id: string): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").update({ needs_contact: true }).eq("id", id);
  if (error) return { ok: false, error: "Nepodařilo se uložit." };
  revalidatePath(`/poptavky/${id}`);
  return { ok: true };
}

export async function clearNeedsContact(id: string, result: string): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  if (!result?.trim()) return { ok: false, error: "Zadejte výsledek hovoru." };

  const supabase = await createClient();
  // Výsledek hovoru se uloží jako poznámka (autor = přihlášený profil).
  await supabase.from("comments").insert({
    inquiry_id: id,
    text: `📞 Výsledek hovoru: ${result.trim()}`,
    author: auth.profile.name,
  });
  const { error } = await supabase.from("inquiries").update({ needs_contact: false }).eq("id", id);
  if (error) return { ok: false, error: "Nepodařilo se uložit." };
  revalidatePath(`/poptavky/${id}`);
  return { ok: true };
}

// POST /api/inquiries/[id]/comments → addComment
export async function addComment(id: string, text: string, author: string): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  if (!text?.trim()) return { ok: false, error: "Prázdný komentář." };

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    inquiry_id: id,
    text: text.trim(),
    author: author?.trim() || auth.profile.name,
  });
  if (error) return { ok: false, error: "Uložení se nezdařilo." };
  revalidatePath(`/poptavky/${id}`);
  return { ok: true };
}
