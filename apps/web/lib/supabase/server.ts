import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@erp/db";

/** Supabase klient pro server components / server actions / route handlers. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Volání ze server component – cookies zapisuje proxy.
          }
        },
      },
    },
  );
}

/**
 * Načte profil přihlášeného uživatele (RLS: vidí ho jen s aktivním profilem).
 * Vrací null, když není přihlášen nebo profil neexistuje/není aktivní.
 */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Bez citlivých sloupců email/poznamka – ty smí přes DB číst jen service-role
  // (odebrané SELECT roli authenticated). Vlastní profil je stejně nepotřebuje.
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, auth_user_id, name, role, oddeleni, assignable, sefkonstrukter, access_modules, color_index, tile_order, active, pozice, osobni_cislo, created_at, updated_at",
    )
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return profile;
}
