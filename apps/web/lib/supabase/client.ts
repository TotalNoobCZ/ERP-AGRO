"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@erp/db";

/** decodeURIComponent, který u vadné hodnoty (osamocené %) nespadne. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Přečte hodnotu cookie z document.cookie (prohlížeč). */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="));
  return match ? safeDecode(match.slice(name.length + 1)) : undefined;
}

/** Supabase klient pro prohlížeč (client components). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          return document.cookie
            .split("; ")
            .filter(Boolean)
            .map((c) => {
              const eq = c.indexOf("=");
              const name = eq === -1 ? c : c.slice(0, eq);
              const value = eq === -1 ? "" : c.slice(eq + 1);
              return { name, value: safeDecode(value) };
            });
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          // „Zapamatovat přihlášení" = vypnuto → z auth cookies odstraníme
          // trvalou životnost, takže po zavření prohlížeče zmizí.
          const rememberOff = readCookie("erp_remember") === "0";
          for (const { name, value, options } of cookiesToSet) {
            // Mazání cookie (odhlášení) pozná podle maxAge<=0 / expires v minulosti –
            // to musíme zachovat vždy, jinak by odhlášení cookie nesmazalo.
            const isDelete =
              (options?.maxAge != null && options.maxAge <= 0) ||
              (options?.expires != null && options.expires.getTime() <= 0);
            const parts = [`${name}=${encodeURIComponent(value)}`];
            const path = options?.path ?? "/";
            parts.push(`path=${path}`);
            if (!rememberOff || isDelete) {
              if (options?.maxAge != null) parts.push(`max-age=${options.maxAge}`);
              if (options?.expires) parts.push(`expires=${options.expires.toUTCString()}`);
            }
            if (options?.domain) parts.push(`domain=${options.domain}`);
            const sameSite = options?.sameSite ?? "lax";
            parts.push(`samesite=${sameSite}`);
            if (options?.secure ?? location.protocol === "https:") parts.push("secure");
            document.cookie = parts.join("; ");
          }
        },
      },
    },
  );
}
