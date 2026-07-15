import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@erp/db";

/**
 * Service-role klient – POUZE server-side (API routes / server actions).
 * Obchází RLS; používá se výhradně pro flow „Jsem tu poprvé"
 * (vyhledání profilu podle e-mailu, založení auth účtu, napojení auth_user_id).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
