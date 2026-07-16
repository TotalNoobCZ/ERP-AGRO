"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { userColor } from "@erp/ui";
import { ROLE_LABELS, type Role } from "@erp/core";
import { ThemeToggle } from "@/components/theme";
import { LinkSpinner } from "@/components/LinkSpinner";

// Hlavní karty vždy otevřou záložku Přehled; `match` řídí zvýraznění pro
// celý modul (i ostatní jeho podstránky).
const MODULES = [
  { href: "/poptavky/dashboard", match: "/poptavky", label: "Poptávky" },
  { href: "/zakazky/dashboard", match: "/zakazky", label: "Zakázky" },
  { href: "/konstrukce/prehled", match: "/konstrukce", label: "Konstrukce" },
  { href: "/sprava", match: "/sprava", label: "Správa" },
] as const;

export interface NavProps {
  name: string;
  role: Role;
  colorIndex: number | null;
}

/** Sdílená navigace – přepínání modulů, jedno přihlášení, jedna session. */
export function Nav({ name, role, colorIndex }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center gap-6 border-b border-border/30 bg-surface px-6 py-3">
      <span className="whitespace-nowrap text-lg font-bold">ERP Strojírenská divize</span>

      <nav className="flex flex-1 gap-2">
        {MODULES.map((m) => {
          const active = pathname.startsWith(m.match);
          return (
            <Link
              key={m.href}
              href={m.href}
              className={
                "inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold transition " +
                (active
                  ? "border-link bg-accent text-text shadow-sm ring-1 ring-link"
                  : "border-line text-text-muted hover:border-link hover:text-text")
              }
            >
              {m.label}
              <LinkSpinner />
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-on-accent"
          style={{ backgroundColor: userColor(colorIndex) }}
          title={`${name} · ${ROLE_LABELS[role]}`}
        >
          {name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </span>
        <button
          onClick={handleLogout}
          className="text-sm text-text-muted hover:text-text"
          type="button"
        >
          Odhlásit
        </button>
      </div>
    </header>
  );
}
