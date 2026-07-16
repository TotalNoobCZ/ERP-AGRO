// Přehled modulu Konstrukce: počty (projekty, úkoly, nepřiřazené, bez termínů,
// splněné čekající), nejbližší konce úkolů, nepřiřazené úkoly.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { nactiKonstrukci } from "@/lib/konstrukce-query";
import { nacistLidiZakazek, sjednotitOsoby, type Osoba } from "@/lib/zakazky/lide";
import { AkceKonstrukteri, type AkceSkupina, type AkceZak } from "@/components/konstrukce/AkceKonstrukteri";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KonstrukcePrehled() {
  const supabase = await createClient();
  const { projekty, ukoly, clenove } = await nactiKonstrukci(supabase);
  const clenById = new Map(clenove.map((c) => [c.id, c.name]));
  const dnes = new Date().toISOString().slice(0, 10);

  // Akce a jejich zakázky s konstruktéry (jen lidé z oddělení Konstrukce).
  const { data: zData } = await supabase
    .from("zakazky")
    .select("id, kod, popis, misto_plneni, parent_id, zacatek, konec_aktualni")
    .is("deleted_at", null)
    .in("stav", ["AKTIVNI", "POZASTAVENO"])
    .order("konec_aktualni", { ascending: true });
  const zak = (zData ?? []) as {
    id: string;
    kod: string;
    popis: string | null;
    misto_plneni: string;
    parent_id: string | null;
    zacatek: string;
    konec_aktualni: string;
  }[];
  const lidiMap = await nacistLidiZakazek(supabase, zak.map((z) => z.id));
  const konstr = (id: string): Osoba[] => (lidiMap.get(id) ?? []).filter((o) => o.oddeleni === "konstrukce");
  const toZak = (z: (typeof zak)[number]): AkceZak => ({
    id: z.id,
    kod: z.kod,
    popis: z.popis,
    mistoPlneni: z.misto_plneni,
    zacatek: z.zacatek,
    konecAktualni: z.konec_aktualni,
    konstrukteri: konstr(z.id),
  });
  const idset = new Set(zak.map((z) => z.id));
  const detiBy = new Map<string, typeof zak>();
  for (const z of zak) {
    if (z.parent_id && idset.has(z.parent_id)) {
      if (!detiBy.has(z.parent_id)) detiBy.set(z.parent_id, []);
      detiBy.get(z.parent_id)!.push(z);
    }
  }
  const akceSkupiny: AkceSkupina[] = zak
    .filter((z) => !z.parent_id || !idset.has(z.parent_id))
    .map((a) => {
      const deti = (detiBy.get(a.id) ?? []).map(toZak);
      const konstrukteriAkce = sjednotitOsoby([konstr(a.id), ...deti.map((d) => d.konstrukteri)]);
      return { akce: toZak(a), konstrukteriAkce, deti };
    });

  const aktivni = ukoly.filter((u) => !u.completed);
  const nepriazene = aktivni.filter((u) => !u.assigneeId);
  const bezTerminu = aktivni.filter((u) => !u.startDate || !u.endDate);
  const splneneCekajici = ukoly.filter((u) => u.completed);
  const nejblizsi = aktivni
    .filter((u) => u.endDate && u.endDate >= dnes)
    .sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Přehled konstrukce</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Aktivní projekty" value={projekty.length} />
        <Stat label="Rozpracované úkoly" value={aktivni.length} />
        <Stat label="Nepřiřazené" value={nepriazene.length} warn={nepriazene.length > 0} />
        <Stat label="Splněné k archivaci" value={splneneCekajici.length} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Akce a konstruktéři</h2>
        <AkceKonstrukteri skupiny={akceSkupiny} />
      </section>

      <Card>
        <CardHeader><CardTitle>📅 Nejbližší konce úkolů</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {nejblizsi.length === 0 && <p className="text-sm text-text-muted">Žádné naplánované konce.</p>}
          {nejblizsi.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.name}</p>
                <p className="text-sm text-text-muted">
                  {u.projectName}{u.assigneeId ? ` · ${clenById.get(u.assigneeId) ?? "?"}` : " · nepřiřazeno"}
                </p>
              </div>
              <span className="text-sm text-text-muted">{formatDen(u.endDate)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className={nepriazene.length > 0 ? "border-amber-400/40" : ""}>
        <CardHeader><CardTitle>🧩 Nepřiřazené úkoly: {nepriazene.length}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {nepriazene.length === 0 && <p className="text-sm text-text-muted">Vše přiřazeno. 👍</p>}
          {nepriazene.slice(0, 10).map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-3 text-sm">
              <span className="truncate">{u.name} <span className="text-text-muted">· {u.projectName}</span></span>
              {u.startDate && u.endDate && (
                <span className="text-text-muted">{formatDen(u.startDate)} – {formatDen(u.endDate)}</span>
              )}
            </div>
          ))}
          <Link href="/konstrukce" className="block pt-1 text-sm text-link hover:underline">Otevřít plánování →</Link>
        </CardContent>
      </Card>

      <p className="text-xs text-text-muted">Úkolů bez termínů: {bezTerminu.length} · zobrazí se jako dlaždice, ne v Ganttu.</p>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <Card className={warn ? "border-amber-400/40" : ""}>
      <CardHeader className="p-4 pb-2"><CardTitle className="normal-case">{label}</CardTitle></CardHeader>
      <CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
