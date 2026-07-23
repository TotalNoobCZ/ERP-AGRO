"use client";
// Podnavigace modulu Zakázky: Přehled / Gantt / Akce / Archiv.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { LinkSpinner } from "@/components/LinkSpinner";
import { PinButton } from "@/components/PinButton";

// Jednotné pořadí napříč moduly: Přehled → seznam → Tabule → Gantt → Archiv.
const TABS = [
  { href: "/zakazky/dashboard", label: "Přehled" },
  { href: "/zakazky", label: "Akce" },
  { href: "/zakazky/tabule", label: "Tabule" },
  { href: "/zakazky/plan", label: "Gantt" },
  { href: "/zakazky/archiv", label: "Archiv" },
] as const;

export function ZakazkySubNav({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/zakazky") {
      // „Akce" = seznam + detail + nová, ale ne ostatní záložky
      return (
        pathname === "/zakazky" ||
        (pathname.startsWith("/zakazky/") &&
          !pathname.startsWith("/zakazky/dashboard") &&
          !pathname.startsWith("/zakazky/plan") &&
          !pathname.startsWith("/zakazky/tabule") &&
          !pathname.startsWith("/zakazky/archiv"))
      );
    }
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
          <PinButton modul="zakazky" href={t.href} />
        </span>
      ))}
      {canWrite && (
        <Link
          href="/zakazky/nova"
          className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          + Nová akce
        </Link>
      )}
    </div>
  );
}
