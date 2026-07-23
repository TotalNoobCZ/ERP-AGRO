// ----------------------------------------------------------------------------
//  Serverové načtení přístupových práv k modulům. Kombinuje výchozí nastavení
//  dle oddělení (department_access) s vlastním nastavením profilu.
// ----------------------------------------------------------------------------
import "server-only";
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import {
  povoleneModuly,
  jenPrirazeneZakazky,
  MODULY,
  type Modul,
  type DepartmentAccess,
} from "@erp/core";

type ProfilPristup = {
  role?: string | null;
  oddeleni?: string | null;
  access_modules?: string[] | null;
} | null;

/** Výchozí přístup k modulům dle oddělení. */
export async function queryDepartmentAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<DepartmentAccess> {
  const { data } = await supabase.from("department_access").select("oddeleni, modules");
  const map: DepartmentAccess = {};
  for (const r of data ?? []) {
    map[r.oddeleni as string] = (r.modules ?? []).filter((m: string) =>
      (MODULY as readonly string[]).includes(m),
    ) as Modul[];
  }
  return map;
}

/** Které moduly daný profil vidí (admin vždy všechny). */
export async function povoleneModulyProProfil(profile: ProfilPristup): Promise<Modul[]> {
  if (!profile) return [];
  if (profile.role === "admin") return [...MODULY];
  const supabase = await createClient();
  const dep = await queryDepartmentAccess(supabase);
  return povoleneModuly(
    { role: profile.role ?? "viewer", oddeleni: profile.oddeleni, accessModules: profile.access_modules },
    dep,
  );
}

/** Vidí profil v Zakázkách jen přiřazené zakázky (kapitola Dílna)? */
export function jenPrirazeneProProfil(profile: ProfilPristup): boolean {
  return jenPrirazeneZakazky(profile?.oddeleni);
}

/**
 * Stráž modulu pro layout: nemá-li přihlášený uživatel přístup, přesměruje
 * na rozcestník. Admin má vždy přístup ke všem modulům.
 */
export async function guardModul(modul: Modul): Promise<void> {
  const profile = await getCurrentProfile();
  const moduly = await povoleneModulyProProfil(profile);
  if (!moduly.includes(modul)) redirect("/");
}
