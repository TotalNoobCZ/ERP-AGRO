"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { userColor } from "@erp/ui";
import { ROLE_LABELS, isAdmin, type Role, type Modul } from "@erp/core";
import { ThemeToggle } from "@/components/theme";
import { LinkSpinner } from "@/components/LinkSpinner";
import { pinKey } from "@/components/PinButton";

// Hlavní karty vždy otevřou záložku Přehled; `match` řídí zvýraznění pro
// celý modul (i ostatní jeho podstránky). Správa jen pro administrátory.
const MODULES = [
  { href: "/poptavky/dashboard", match: "/poptavky", label: "Poptávky", adminOnly: false, vedeniOnly: false, modul: "poptavky" as Modul },
  { href: "/zakazky/dashboard", match: "/zakazky", label: "Zakázky", adminOnly: false, vedeniOnly: false, modul: "zakazky" as Modul },
  { href: "/konstrukce/prehled", match: "/konstrukce", label: "Konstrukce", adminOnly: false, vedeniOnly: false, modul: "konstrukce" as Modul },
  { href: "/dilna/tabule", match: "/dilna", label: "Dílna", adminOnly: false, vedeniOnly: false, modul: "dilna" as Modul },
  { href: "/report", match: "/report", label: "Report", adminOnly: false, vedeniOnly: true, modul: null },
  { href: "/sprava", match: "/sprava", label: "Správa", adminOnly: true, vedeniOnly: false, modul: null },
] as const;

export interface NavProps {
  name: string;
  role: Role;
  colorIndex: number | null;
  colorHex: string | null;
  /** Moduly, na které má uživatel přístup (Správa se řídí adminOnly). */
  moduly: Modul[];
}

/** Sdílená navigace – přepínání modulů, jedno přihlášení, jedna session. */
export function Nav({ name, role, colorIndex, colorHex, moduly }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    // Mobil: dva řádky (značka + uživatel / posuvný pás modulů), desktop: jeden.
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/30 bg-surface px-3 py-2 sm:gap-6 sm:px-6 sm:py-3">
      <Link href="/" className="whitespace-nowrap text-base font-bold hover:text-link sm:text-lg">
        <span className="sm:hidden">ERP</span>
        <span className="hidden sm:inline">ERP Strojírenská divize</span>
      </Link>

      <nav className="order-last -mx-3 flex w-[100vw] gap-2 overflow-x-auto px-3 pb-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:px-0 sm:pb-0">
        {MODULES.filter((m) =>
          m.adminOnly
            ? isAdmin(role)
            : m.vedeniOnly
              ? isAdmin(role) || role === "vedouci"
              : m.modul != null && moduly.includes(m.modul),
        ).map((m) => {
          const active = pathname.startsWith(m.match);
          return (
            <Link
              key={m.href}
              href={m.href}
              onClick={(e) => {
                // Otevři přišpendlenou záložku uživatele, pokud nějakou má.
                try {
                  const pin = localStorage.getItem(pinKey(m.match.slice(1)));
                  if (pin && pin !== m.href) {
                    e.preventDefault();
                    router.push(pin);
                  }
                } catch {
                  /* ignore */
                }
              }}
              className={
                "inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-semibold transition sm:px-4 sm:py-2 " +
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

      <div className="ml-auto flex items-center gap-2 sm:ml-0 sm:gap-3">
        <ThemeToggle />
        <Link
          href="/napoveda"
          data-tip="Nápověda / manuál k aplikaci"
          data-tip-pos="bottom"
          aria-label="Nápověda"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-sm font-bold text-text-muted transition hover:border-link hover:text-link"
        >
          i
        </Link>
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-on-accent"
          style={{ backgroundColor: userColor(colorIndex, colorHex) }}
          data-tip={`${name} · ${ROLE_LABELS[role]}`}
          data-tip-pos="bottom"
        >
          {name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </span>
        <Link href="/heslo" className="text-sm text-text-muted hover:text-text">
          Heslo
        </Link>
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
