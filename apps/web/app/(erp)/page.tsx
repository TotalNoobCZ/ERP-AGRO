// Úvodní stránka = osobní rozcestník „Moje práce": co čeká přihlášeného
// uživatele (připomínky, jeho poptávky a zakázky) + dlaždice modulů.
import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { povoleneModulyProProfil } from "@/lib/pristup";
import { queryDueReminders } from "@/lib/poptavky-query";
import { queryMojePoptavky, queryMojeZakazky } from "@/lib/moje-prace";
import { StatusBadge, DeadlineBadge } from "@/components/poptavky/badges";
import { StavBadge } from "@/components/zakazky/common";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { poTerminu } from "@/lib/zakazky/orders";
import { isAdmin, type Role, type Modul, type StavZakazky } from "@erp/core";

const KARTY = [
  { href: "/poptavky/dashboard", label: "Poptávky", emoji: "📥", popis: "Poptávky, nabídky a zákazníci", adminOnly: false, modul: "poptavky" as Modul },
  { href: "/zakazky/dashboard", label: "Zakázky", emoji: "📋", popis: "Výrobní zakázky, plán a tabule", adminOnly: false, modul: "zakazky" as Modul },
  { href: "/konstrukce/prehled", label: "Konstrukce", emoji: "📐", popis: "Konstrukční plánování a Gantt", adminOnly: false, modul: "konstrukce" as Modul },
  { href: "/dilna/tabule", label: "Dílna", emoji: "🔧", popis: "Výroba – lidé, fáze a Gantt", adminOnly: false, modul: "dilna" as Modul },
  { href: "/sprava", label: "Správa", emoji: "⚙️", popis: "Uživatelé a nastavení", adminOnly: true, modul: null },
] as const;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const admin = profile ? isAdmin(profile.role as Role) : false;
  const moduly = await povoleneModulyProProfil(profile);
  const karty = KARTY.filter((k) => (k.adminOnly ? admin : k.modul != null && moduly.includes(k.modul)));

  const supabase = await createClient();
  const uid = profile?.id;
  const maPoptavky = moduly.includes("poptavky");
  const maZakazky = moduly.includes("zakazky") || moduly.includes("dilna");

  const [pripominky, mojePoptavky, mojeZakazky] = await Promise.all([
    uid && maPoptavky ? queryDueReminders(supabase, uid) : Promise.resolve([]),
    uid && maPoptavky ? queryMojePoptavky(supabase, uid) : Promise.resolve([]),
    uid && maZakazky ? queryMojeZakazky(supabase, uid) : Promise.resolve([]),
  ]);

  const zakazkyPoTerminu = mojeZakazky.filter((z) =>
    poTerminu({ konecAktualni: parseDay(z.konecAktualni), stav: z.stav as StavZakazky }),
  ).length;
  const nicNecekaMe =
    pripominky.length === 0 && mojePoptavky.length === 0 && mojeZakazky.length === 0;

  const jmeno = profile?.name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-2">
      <div>
        <h1 className="text-2xl font-bold">Moje práce{jmeno ? ` — ${jmeno}` : ""}</h1>
        <p className="mt-1 text-sm text-text-muted">Co tě čeká napříč systémem.</p>
      </div>

      {/* Připomínky odložených poptávek */}
      {pripominky.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <h2 className="mb-2 font-semibold">⏰ Čas kontaktovat odložené poptávky ({pripominky.length})</h2>
          <ul className="space-y-1 text-sm">
            {pripominky.map((d) => (
              <li key={d.id}>
                <Link href={`/poptavky/${d.id}`} className="font-medium underline">
                  #{d.number} – {d.subject}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nicNecekaMe && (
        <section className="rounded-xl border border-line bg-surface p-6 text-center text-text-muted">
          Teď tě nic netlačí. 🎉 Vyber si modul níže.
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Moje poptávky */}
        {maPoptavky && mojePoptavky.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Moje poptávky ({mojePoptavky.length})
              </h2>
              <Link href="/poptavky" className="text-xs text-link hover:underline">Vše →</Link>
            </div>
            <div className="card divide-y divide-line">
              {mojePoptavky.slice(0, 8).map((p) => (
                <Link key={p.id} href={`/poptavky/${p.id}`} className="flex items-center gap-2 p-3 hover:bg-accent">
                  <span className="w-10 shrink-0 text-xs text-text-muted">#{p.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.subject}</span>
                    <span className="block truncate text-xs text-text-muted">{p.customerName}</span>
                  </span>
                  {p.needsContact && <span className="shrink-0 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[11px] text-orange-700">📞</span>}
                  <StatusBadge status={p.status} />
                  <DeadlineBadge deadline={p.deadline} status={p.status} />
                </Link>
              ))}
            </div>
            {mojePoptavky.length > 8 && (
              <p className="text-xs text-text-muted">…a dalších {mojePoptavky.length - 8}</p>
            )}
          </section>
        )}

        {/* Moje zakázky */}
        {maZakazky && mojeZakazky.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Moje zakázky ({mojeZakazky.length}{zakazkyPoTerminu > 0 ? `, ${zakazkyPoTerminu} po termínu` : ""})
              </h2>
              <Link href="/zakazky" className="text-xs text-link hover:underline">Vše →</Link>
            </div>
            <div className="card divide-y divide-line">
              {mojeZakazky.slice(0, 8).map((z) => (
                <Link key={z.id} href={`/zakazky/${z.id}`} className="flex items-center gap-2 p-3 hover:bg-accent">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      <span className="font-mono">{z.kod}</span> · {z.popis || z.mistoPlneni}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {z.role} · do {formatCz(parseDay(z.konecAktualni))}
                    </span>
                  </span>
                  <StavBadge z={{ konecAktualni: parseDay(z.konecAktualni), stav: z.stav as StavZakazky }} />
                </Link>
              ))}
            </div>
            {mojeZakazky.length > 8 && (
              <p className="text-xs text-text-muted">…a dalších {mojeZakazky.length - 8}</p>
            )}
          </section>
        )}
      </div>

      {/* Dlaždice modulů */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Moduly</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {karty.map((k) => (
            <Link
              key={k.href}
              href={k.href}
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-link hover:shadow-md"
            >
              <span className="text-3xl">{k.emoji}</span>
              <span className="min-w-0">
                <span className="block font-bold group-hover:text-link">{k.label}</span>
                <span className="block text-xs text-text-muted">{k.popis}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
