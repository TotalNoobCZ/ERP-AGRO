"use client";
// Podnavigace modulu Poptávky (v původní app horní lišta celé aplikace).
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/poptavky/dashboard", label: "Přehled" },
  { href: "/poptavky", label: "Poptávky" },
  { href: "/poptavky?status=OBJEDNANO", label: "Objednáno" },
  { href: "/zakaznici", label: "Zákazníci" },
] as const;

function Tabs({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();

  function isActive(href: string): boolean {
    const [path, query] = href.split("?");
    if (pathname !== path) return false;
    const wantsObjednano = query?.includes("status=OBJEDNANO") ?? false;
    const hasObjednano = params.get("status") === "OBJEDNANO";
    return wantsObjednano === hasObjednano;
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
          href="/poptavky/nova"
          className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          + Nová poptávka
        </Link>
      )}
    </div>
  );
}

export function PoptavkySubNav({ canWrite }: { canWrite: boolean }) {
  return (
    <Suspense fallback={<div className="mb-4 h-12 border-b" />}>
      <Tabs canWrite={canWrite} />
    </Suspense>
  );
}
