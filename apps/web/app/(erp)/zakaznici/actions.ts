"use server";
// ----------------------------------------------------------------------------
//  Server actions pro zákazníky a kontakty (sdílená entita, správa v modulu
//  Poptávky). Logika 1:1 z Popt-vky/app/api/customers* a /api/contacts*.
// ----------------------------------------------------------------------------
import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { canWrite, type Role } from "@erp/core";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

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

export type CustomerInput = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
};

export async function createCustomer(input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  if (!input.name?.trim()) return { ok: false, error: "Název zákazníka je povinný." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      country: input.country?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Uložení se nezdařilo." };
  revalidatePath("/zakaznici");
  return { ok: true, data: { id: data.id } };
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  if (!input.name?.trim()) return { ok: false, error: "Název zákazníka je povinný." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      country: input.country?.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Uložení se nezdařilo." };
  revalidatePath("/zakaznici");
  revalidatePath(`/zakaznici/${id}`);
  return { ok: true };
}

/** Smazání blokujeme, pokud na zákazníkovi visí poptávky (jako v originále). */
export async function deleteCustomer(id: string): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { count } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);
  if (count && count > 0) {
    return {
      ok: false,
      error: `Zákazníka nelze smazat – má ${count} poptávek. Nejdřív je přeřaďte nebo smažte.`,
    };
  }
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, error: "Smazání se nezdařilo." };
  revalidatePath("/zakaznici");
  return { ok: true };
}

export type ContactInput = { name: string; phone?: string; email?: string };
export type ContactRowLite = { id: string; name: string; phone: string | null; email: string | null };

export async function addContact(
  customerId: string,
  input: ContactInput,
): Promise<ActionResult<{ contact: ContactRowLite }>> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  if (!input.name?.trim()) return { ok: false, error: "Jméno kontaktu je povinné." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      customer_id: customerId,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    })
    .select("id, name, phone, email")
    .single();
  if (error || !data) return { ok: false, error: "Uložení se nezdařilo." };
  revalidatePath(`/zakaznici/${customerId}`);
  return { ok: true, data: { contact: data } };
}

export async function updateContact(id: string, input: ContactInput): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  if (!input.name?.trim()) return { ok: false, error: "Jméno kontaktu je povinné." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Uložení se nezdařilo." };
  return { ok: true };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const auth = await requireWriter();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { ok: false, error: "Smazání se nezdařilo." };
  return { ok: true };
}
