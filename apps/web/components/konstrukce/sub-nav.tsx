"use client";
// Podnavigace modulu Konstrukce: Plánování / Gantt / Archiv.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/konstrukce/prehled", label: "Přehled" },
  { href: "/konstrukce", label: "Plánování" },
  { href: "/konstrukce/gantt", label: "Gantt" },
  { href: "/konstrukce/archiv", label: "Archiv" },
] as const;

export function KonstrukceSubNav({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();
  void canWrite;

  function isActive(href: string): boolean {
    if (href === "/konstrukce") {
      return pathname === "/konstrukce";
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
      <Link
        href="/konstrukce/tisk?print=1"
        className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition hover:text-text"
      >
        🖨 Export do PDF
      </Link>
    </div>
  );
}
