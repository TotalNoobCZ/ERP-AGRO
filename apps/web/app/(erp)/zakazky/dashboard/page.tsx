// Přehled modulu Zakázky (jednotné s Poptávkami): počty stavů, nejbližší konce,
// po termínu, nejbližší milníky.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StavBadge } from "@/components/zakazky/common";
import { parseDay, formatCz, today, formatDay } from "@/lib/zakazky/dates";
import { poTerminu } from "@/lib/zakazky/orders";
import { MILNIK_LABELS, ZAKAZKA_STAV_LABELS, type StavZakazky, type TypMilniku } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function ZakazkyDashboard() {
  const supabase = await createClient();
  const dnesIso = formatDay(today());

  const [vse, milnikyRes] = await Promise.all([
    supabase
      .from("zakazky")
      .select("id, kod, misto_plneni, popis, parent_id, konec_aktualni, stav")
      .is("deleted_at", null)
      .neq("stav", "ARCHIV"),
    supabase
      .from("milniky")
      .select("id, typ, datum, zakazka:zakazky!inner(id, kod, deleted_at)")
      .is("deleted_at", null)
      .is("zakazka.deleted_at", null)
      .gte("datum", dnesIso)
      .order("datum", { ascending: true })
      .limit(6),
  ]);

  type Z = { id: string; kod: string; misto_plneni: string; popis: string | null; parent_id: string | null; konec_aktualni: string; stav: StavZakazky };
  const zakazky = (vse.data ?? []) as Z[];
  const withStav = zakazky.map((z) => ({ ...z, po: poTerminu({ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }) }));

  const pocet = {
    AKTIVNI: withStav.filter((z) => z.stav === "AKTIVNI" && !z.po).length,
    POZASTAVENO: withStav.filter((z) => z.stav === "POZASTAVENO" && !z.po).length,
    FAKTURACE: withStav.filter((z) => z.stav === "FAKTURACE").length,
    PROPLACENO: withStav.filter((z) => z.stav === "PROPLACENO").length,
    PO: withStav.filter((z) => z.po).length,
  };

  const poTerm = withStav.filter((z) => z.po).sort((a, b) => a.konec_aktualni.localeCompare(b.konec_aktualni)).slice(0, 6);
  const nejblizsi = withStav
    .filter((z) => !z.po && (z.stav === "AKTIVNI" || z.stav === "POZASTAVENO") && z.konec_aktualni >= dnesIso)
    .sort((a, b) => a.konec_aktualni.localeCompare(b.konec_aktualni))
    .slice(0, 6);
  const milniky = (milnikyRes.data ?? []) as unknown as {
    id: string; typ: string; datum: string; zakazka: { id: string; kod: string } | null;
  }[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Přehled zakázek</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatKarta href="/zakazky?stav=AKTIVNI" label="Aktivní" value={pocet.AKTIVNI} />
        <StatKarta href="/zakazky?stav=PO_TERMINU" label="Po termínu" value={pocet.PO} warn={pocet.PO > 0} />
        <StatKarta href="/zakazky?stav=POZASTAVENO" label="Pozastaveno" value={pocet.POZASTAVENO} />
        <StatKarta href="/zakazky/fakturace" label="Fakturace" value={pocet.FAKTURACE} warn={pocet.FAKTURACE > 0} />
        <StatKarta href="/zakazky/fakturace" label="Proplaceno" value={pocet.PROPLACENO} />
      </div>

      <Card className={pocet.PO > 0 ? "border-red-400/50" : ""}>
        <CardHeader>
          <Link href="/zakazky?stav=PO_TERMINU" className="hover:underline">
            <CardTitle>⚠️ Po termínu: {pocet.PO}</CardTitle>
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {poTerm.length === 0 && <p className="text-sm text-text-muted">Žádné akce po termínu. 👍</p>}
          {poTerm.map((z) => <RadekZakazky key={z.id} z={z} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📅 Nejbližší konce</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {nejblizsi.length === 0 && <p className="text-sm text-text-muted">Žádné blížící se konce.</p>}
          {nejblizsi.map((z) => <RadekZakazky key={z.id} z={z} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>🏭 Nejbližší milníky</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {milniky.length === 0 && <p className="text-sm text-text-muted">Žádné blížící se milníky.</p>}
          {milniky.map((m) => (
            <Link
              key={m.id}
              href={m.zakazka ? `/zakazky/${m.zakazka.id}` : "/zakazky"}
              className="flex items-center justify-between gap-2 rounded-lg border border-line p-3 hover:bg-accent"
            >
              <span className="text-sm">
                <span className="font-mono">{m.zakazka?.kod ?? "?"}</span> · {MILNIK_LABELS[m.typ as TypMilniku] ?? m.typ}
              </span>
              <span className="text-sm text-text-muted">{formatCz(parseDay(m.datum))}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatKarta({ href, label, value, warn }: { href: string; label: string; value: number; warn?: boolean }) {
  return (
    <Link href={href}>
      <Card className={`transition-colors hover:bg-accent ${warn ? "border-red-400/50" : ""}`}>
        <CardHeader className="p-4 pb-2"><CardTitle className="normal-case">{label}</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{value}</p></CardContent>
      </Card>
    </Link>
  );
}

function RadekZakazky({ z }: { z: { id: string; kod: string; misto_plneni: string; popis: string | null; parent_id: string | null; konec_aktualni: string; stav: StavZakazky } }) {
  // U zakázky k akci (podzakázky) ukážeme i popis – samotné číslo (826001) nic neřekne.
  const jePodzakazka = !!z.parent_id;
  return (
    <Link href={`/zakazky/${z.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 hover:bg-accent">
      <div className="min-w-0">
        <p className="truncate font-medium">
          <span className="font-mono">{z.kod}</span> · {z.misto_plneni}
          {jePodzakazka && z.popis && <span className="font-normal text-text-muted"> — {z.popis}</span>}
        </p>
        <p className="text-sm text-text-muted">{ZAKAZKA_STAV_LABELS[z.stav]}</p>
      </div>
      <div className="flex items-center gap-2">
        <StavBadge z={{ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }} />
        <span className="text-sm text-text-muted">{formatCz(parseDay(z.konec_aktualni))}</span>
      </div>
    </Link>
  );
}
