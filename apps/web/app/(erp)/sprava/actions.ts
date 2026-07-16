"use server";
// Správa uživatelů (profily) – jen admin. Nahrazuje osoby/actions.ts
// z Planovani a Správu z Konstrukce (jeden model lidí = profiles).
import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { profilSchema } from "@/lib/zakazky/validations";

export type ProfilStav = { chyby?: Record<string, string>; obecna?: string; ok?: boolean };

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

function ziskat(fd: FormData) {
  return {
    name: String(fd.get("name") ?? ""),
    email: String(fd.get("email") ?? "").toLowerCase(),
    role: String(fd.get("role") ?? "viewer"),
    oddeleni: String(fd.get("oddeleni") ?? ""),
    assignable: true, // automaticky u všech (pole ve formuláři zrušeno)
    sefkonstrukter: fd.get("sefkonstrukter") === "on",
    colorIndex: Number(fd.get("colorIndex") ?? 0),
    active: fd.get("active") !== null ? fd.get("active") === "on" : true,
    pozice: String(fd.get("pozice") ?? ""),
    osobniCislo: String(fd.get("osobniCislo") ?? ""),
    poznamka: String(fd.get("poznamka") ?? ""),
  };
}

export async function vytvoritProfil(_prev: ProfilStav, fd: FormData): Promise<ProfilStav> {
  const a = await admin();
  if (!a) return { obecna: "Správa uživatelů je jen pro administrátory." };

  const parsed = profilSchema.safeParse(ziskat(fd));
  if (!parsed.success) {
    const chyby: Record<string, string> = {};
    for (const i of parsed.error.issues) chyby[String(i.path[0])] = i.message;
    return { chyby };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").insert({
    name: d.name,
    email: d.email || null, // prázdný e-mail (dílna) → NULL kvůli unique
    role: d.role,
    oddeleni: d.oddeleni || null,
    assignable: d.assignable,
    color_index: d.colorIndex ?? null,
    active: d.active,
    pozice: d.pozice || null,
    osobni_cislo: d.osobniCislo || null,
    poznamka: d.poznamka || null,
  });
  if (error) {
    if (error.code === "23505") return { chyby: { email: "Profil s tímto e-mailem už existuje." } };
    return { obecna: "Uložení se nezdařilo." };
  }
  revalidatePath("/sprava");
  return { ok: true };
}

export async function upravitProfil(id: string, _prev: ProfilStav, fd: FormData): Promise<ProfilStav> {
  const a = await admin();
  if (!a) return { obecna: "Správa uživatelů je jen pro administrátory." };

  const parsed = profilSchema.safeParse(ziskat(fd));
  if (!parsed.success) {
    const chyby: Record<string, string> = {};
    for (const i of parsed.error.issues) chyby[String(i.path[0])] = i.message;
    return { chyby };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      name: d.name,
      email: d.email || null, // prázdný e-mail (dílna) → NULL kvůli unique
      role: d.role,
      oddeleni: d.oddeleni || null,
      assignable: d.assignable,
      sefkonstrukter: d.sefkonstrukter,
      color_index: d.colorIndex ?? null,
      active: d.active,
      pozice: d.pozice || null,
      osobni_cislo: d.osobniCislo || null,
      poznamka: d.poznamka || null,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { chyby: { email: "Profil s tímto e-mailem už existuje." } };
    return { obecna: "Uložení se nezdařilo." };
  }
  revalidatePath("/sprava");
  revalidatePath(`/sprava/${id}`);
  return { ok: true };
}
