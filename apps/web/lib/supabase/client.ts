"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@erp/db";

/** Supabase klient pro prohlížeč (client components). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
