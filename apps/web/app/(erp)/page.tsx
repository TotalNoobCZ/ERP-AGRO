// Hlavní vstupní stránka (rozcestník) – dlaždice hlavních modulů.
// Dostupná kliknutím na název „ERP Strojírenská divize" v hlavičce.
import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/server";
import { povoleneModulyProProfil } from "@/lib/pristup";
import { isAdmin, type Role, type Modul } from "@erp/core";

const KARTY = [
  { href: "/poptavky/dashboard", label: "Poptávky", emoji: "📥", popis: "Poptávky, nabídky a zákazníci", adminOnly: false, modul: "poptavky" as Modul },
  { href: "/zakazky/dashboard", label: "Zakázky", emoji: "📋", popis: "Výrobní zakázky, plán a tabule", adminOnly: false, modul: "zakazky" as Modul },
  { href: "/konstrukce/prehled", label: "Konstrukce", emoji: "📐", popis: "Konstrukční plánování a Gantt", adminOnly: false, modul: "konstrukce" as Modul },
  { href: "/sprava", label: "Správa", emoji: "⚙️", popis: "Uživatelé a nastavení", adminOnly: true, modul: null },
] as const;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const admin = profile ? isAdmin(profile.role as Role) : false;
  const moduly = await povoleneModulyProProfil(profile);
  const karty = KARTY.filter((k) =>
    k.adminOnly ? admin : k.modul != null && moduly.includes(k.modul),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">ERP Strojírenská divize</h1>
        <p className="mt-2 text-text-muted">Poptávky · Zakázky · Konstrukce – jeden systém</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {karty.map((k) => (
          <Link
            key={k.href}
            href={k.href}
            className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-6 shadow-sm transition hover:border-link hover:shadow-md"
          >
            <span className="text-4xl">{k.emoji}</span>
            <span className="min-w-0">
              <span className="block text-xl font-bold group-hover:text-link">{k.label}</span>
              <span className="block text-sm text-text-muted">{k.popis}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
