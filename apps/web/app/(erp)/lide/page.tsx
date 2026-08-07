// Modul Lidé: karty zaměstnanců seskupené podle oddělení, s hledáním.
// Přístup řídí matice práv (Správa → Přístupová práva, modul „Lidé").
// Detail /lide/[id] zůstává přístupný všem přihlášeným (dvojklik na tabulích).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { guardModul } from "@/lib/pristup";
import { userColor } from "@erp/ui";
import { ODDELENI, ODDELENI_LABELS, KAPITOLY, KAPITOLA_LABELS, ODDELENI_KAPITOLA, type Oddeleni } from "@erp/core";
import { LideHledani } from "@/components/lide/LideHledani";

export const dynamic = "force-dynamic";

type Zamestnanec = {
  id: string;
  name: string;
  oddeleni: string | null;
  pozice: string | null;
  color_index: number | null;
  color_hex: string | null;
  active: boolean;
};

export default async function LidePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await guardModul("lide");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, oddeleni, pozice, color_index, color_hex, active")
    .order("name");
  const vsichni = ((data ?? []) as Zamestnanec[]).filter(
    (p) => !q || p.name.toLowerCase().includes(q) || (p.pozice ?? "").toLowerCase().includes(q),
  );
  const aktivni = vsichni.filter((p) => p.active);
  const neaktivni = vsichni.filter((p) => !p.active);

  // Skupiny: kapitoly → oddělení (v pořadí číselníku), bez oddělení na konec.
  const skupiny: { nazev: string; lide: Zamestnanec[] }[] = [];
  for (const kap of KAPITOLY) {
    for (const odd of ODDELENI.filter((o) => ODDELENI_KAPITOLA[o] === kap)) {
      const lide = aktivni.filter((p) => p.oddeleni === odd);
      if (lide.length > 0) skupiny.push({ nazev: `${ODDELENI_LABELS[odd]} · ${KAPITOLA_LABELS[kap]}`, lide });
    }
  }
  const bezOddeleni = aktivni.filter((p) => !p.oddeleni);
  if (bezOddeleni.length > 0) skupiny.push({ nazev: "Bez oddělení", lide: bezOddeleni });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lidé</h1>
        <span className="text-sm text-text-muted">{aktivni.length} aktivních</span>
      </div>

      <LideHledani />

      {skupiny.length === 0 && <p className="text-sm text-text-muted">Nikdo neodpovídá hledání.</p>}

      {skupiny.map((sk) => (
        <section key={sk.nazev} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {sk.nazev} ({sk.lide.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sk.lide.map((p) => (
              <Karta key={p.id} p={p} />
            ))}
          </div>
        </section>
      ))}

      {neaktivni.length > 0 && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium text-text-muted">
            Neaktivní ({neaktivni.length})
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {neaktivni.map((p) => (
              <Karta key={p.id} p={p} neaktivni />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Karta({ p, neaktivni = false }: { p: Zamestnanec; neaktivni?: boolean }) {
  return (
    <Link
      href={`/lide/${p.id}`}
      className={`flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-link hover:shadow-sm ${neaktivni ? "opacity-60 grayscale" : ""}`}
    >
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold"
        style={{ backgroundColor: userColor(p.color_index, p.color_hex), color: "#16181b" }}
      >
        {p.name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{p.name}</span>
        <span className="block truncate text-xs text-text-muted">
          {[p.oddeleni ? ODDELENI_LABELS[p.oddeleni as Oddeleni] : null, p.pozice].filter(Boolean).join(" · ") || "—"}
        </span>
      </span>
    </Link>
  );
}
