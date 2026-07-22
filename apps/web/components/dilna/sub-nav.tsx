"use client";
// Podnavigace modulu Dílna: Zakázky (fáze + uskladnění) / Tabule / Gantt.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { LinkSpinner } from "@/components/LinkSpinner";
import { PinButton } from "@/components/PinButton";

const TABS = [
  { href: "/dilna", label: "Zakázky" },
  { href: "/dilna/tabule", label: "Tabule" },
  { href: "/dilna/gantt", label: "Gantt" },
] as const;

export function DilnaSubNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/dilna") return pathname === "/dilna";
    return pathname.startsWith(href);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1 border-b pb-3">
      {TABS.map((t) => (
        <span key={t.href} className="inline-flex items-center">
          <Link
            href={t.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              isActive(t.href) ? "bg-accent text-text" : "text-text-muted hover:text-text",
            )}
          >
            {t.label}
            <LinkSpinner />
          </Link>
          <PinButton modul="dilna" href={t.href} />
        </span>
      ))}
    </div>
  );
}
