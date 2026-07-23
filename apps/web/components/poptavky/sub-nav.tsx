"use client";
// Podnavigace modulu Poptávky (v původní app horní lišta celé aplikace).
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { LinkSpinner } from "@/components/LinkSpinner";
import { PinButton } from "@/components/PinButton";

const TABS = [
  { href: "/poptavky/dashboard", label: "Přehled" },
  { href: "/poptavky", label: "Poptávky" },
  { href: "/poptavky/tabule", label: "Tabule" },
  { href: "/poptavky/odlozene", label: "Odložené" },
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
          <PinButton modul="poptavky" href={t.href} />
        </span>
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
