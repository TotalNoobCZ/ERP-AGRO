"use client";
// Podnavigace modulu Zakázky: Přehled / Plán / Akce / Archiv.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/zakazky/dashboard", label: "Přehled" },
  { href: "/zakazky/plan", label: "Plán" },
  { href: "/zakazky", label: "Akce" },
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
          !pathname.startsWith("/zakazky/archiv"))
      );
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1 border-b pb-3">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition",
            isActive(t.href) ? "bg-accent text-text" : "text-text-muted hover:text-text",
          )}
        >
          {t.label}
        </Link>
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
