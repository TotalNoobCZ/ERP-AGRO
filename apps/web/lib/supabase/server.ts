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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return profile;
}
