// Report pro vedení – měsíční provozní přehled napříč moduly (poptávky,
// zakázky, fakturace, vytížení lidí, konstrukce). Jen admin a vedoucí.
import Link from "next/link";
import { formatKod } from "@erp/core";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { nactiReport, smiVidetReport, vytizeniPodleOddeleni } from "@/lib/report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ReportOvladani } from "@/components/report/ReportOvladani";
import { parseDay, formatCz } from "@/lib/zakazky/dates";

export const dynamic = "force-dynamic";

const MESICE_CZ = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

/** „YYYY-MM" → „srpen 2026", „YYYY" → „rok 2026" */
function obdobiCz(ref: string): string {
  if (/^\d{4}$/.test(ref)) return `rok ${ref}`;
  const [y, m] = ref.split("-").map(Number);
  return `${MESICE_CZ[(m ?? 1) - 1]} ${y}`;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const profile = await getCurrentProfile();
  if (!smiVidetReport(profile?.role)) redirect("/");

  const sp = await searchParams;
  const r = await nactiReport(sp.ref);

  const maxTrend = Math.max(1, ...r.trend.flatMap((t) => [t.poptavkyPrijate, t.poptavkyObjednane, t.akceZahajene, t.akceKoncici]));
  const vytizeniSkupiny = vytizeniPodleOddeleni(r.vytizeni);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Report pro vedení</h1>
          <p className="text-sm text-text-muted">
            Období: {formatCz(parseDay(r.obdobi.od))} – {formatCz(parseDay(r.obdobi.do))} · sestaveno {formatCz(parseDay(r.dnes))}
          </p>
        </div>
        <ReportOvladani refObdobi={r.ref} typ={r.typ} dnes={r.dnes} />
      </div>

      {/* Souhrn */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Aktivní akce" value={r.zakazky.aktivni} href="/zakazky?stav=AKTIVNI" />
        <Stat label="Po termínu" value={r.zakazky.poTerminu.length} warn={r.zakazky.poTerminu.length > 0} href="/zakazky?stav=PO_TERMINU" />
        <Stat label="Ve fakturaci" value={r.fakturace.polozky.length} href="/zakazky/fakturace" />
        <Stat label="Otevřené poptávky" value={r.poptavky.otevreneCelkem} href="/poptavky" />
        <Stat label="Aktivní projekty" value={r.konstrukce.aktivniProjekty} href="/konstrukce" />
        <Stat label="Úkoly po termínu" value={r.konstrukce.poTerminuUkoly} warn={r.konstrukce.poTerminuUkoly > 0} href="/konstrukce/gantt" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Poptávky za období */}
        <Card>
          <CardHeader><CardTitle>📥 Poptávky — {obdobiCz(r.ref)}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Přijaté" value={r.poptavky.prijate} />
              <MiniStat label="Objednáno" value={r.poptavky.objednano} />
              <MiniStat label="Zamítnuto" value={r.poptavky.zamitnuto} />
            </div>
            <p className="text-sm text-text-muted">
              Úspěšnost uzavřených:{" "}
              <strong className="text-text">{r.poptavky.uspesnost == null ? "—" : pct(r.poptavky.uspesnost)}</strong>
              {r.poptavky.uspesnost != null && ` (${r.poptavky.objednano} z ${r.poptavky.objednano + r.poptavky.zamitnuto})`}
            </p>
            {r.poptavky.otevrene.length > 0 && (
              <div className="text-sm">
                <p className="mb-1 font-medium">Otevřené teď ({r.poptavky.otevreneCelkem}):</p>
                <ul className="space-y-0.5 text-text-muted">
                  {r.poptavky.otevrene.map((s) => (
                    <li key={s.stav} className="flex justify-between"><span>{s.label}</span><span>{s.pocet}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zakázky za období */}
        <Card>
          <CardHeader><CardTitle>📋 Akce — {obdobiCz(r.ref)}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Zahájené" value={r.zakazky.zahajene} />
              <MiniStat label="Končící" value={r.zakazky.koncici} />
              <MiniStat label="Prodloužení" value={r.zakazky.prodlouzeni.length} />
            </div>
            <p className="text-sm text-text-muted">
              Teď běží <strong className="text-text">{r.zakazky.aktivni}</strong> akcí, pozastaveno{" "}
              <strong className="text-text">{r.zakazky.pozastaveno}</strong>, proplaceno celkem{" "}
              <strong className="text-text">{r.fakturace.proplacenoCelkem}</strong>.
            </p>
            {r.zakazky.prodlouzeni.length > 0 && (
              <div className="text-sm">
                <p className="mb-1 font-medium">Prodloužení v období:</p>
                <ul className="space-y-1 text-text-muted">
                  {r.zakazky.prodlouzeni.slice(0, 6).map((p, i) => (
                    <li key={i}>
                      <Link href={`/zakazky/${p.zakazkaId}`} className="font-mono text-link hover:underline">{formatKod(p.kod)}</Link>{" "}
                      {formatCz(parseDay(p.staryKonec))} → {formatCz(parseDay(p.novyKonec))} — {p.duvod}
                    </li>
                  ))}
                  {r.zakazky.prodlouzeni.length > 6 && <li>…a dalších {r.zakazky.prodlouzeni.length - 6}</li>}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Odpovědnosti podle agendy: akce a poptávky */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>🗂 Akce podle odpovědných — {obdobiCz(r.ref)}</CardTitle></CardHeader>
          <CardContent>
            {r.akcePodleOsob.length === 0 ? (
              <p className="text-sm text-text-muted">Žádné akce s odpovědnou osobou v období.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-text-muted">
                    <th className="py-1.5 font-medium">Jméno</th>
                    <th className="py-1.5 text-right font-medium">Akce na starost</th>
                  </tr>
                </thead>
                <tbody>
                  {r.akcePodleOsob.map((m) => (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="py-1.5">
                        {m.jmeno} <span className="text-xs text-text-muted">· {m.pozice}</span>
                      </td>
                      <td className="py-1.5 text-right font-medium">{m.akce}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Hlavní akce zasahující do období, počítané podle odpovědné osoby akce.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>📥 Poptávky podle odpovědných — {obdobiCz(r.ref)}</CardTitle></CardHeader>
          <CardContent>
            {r.poptavkyPodleOsob.length === 0 ? (
              <p className="text-sm text-text-muted">Žádné poptávky s odpovědnou osobou v období.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-text-muted">
                    <th className="py-1.5 font-medium">Jméno</th>
                    <th className="py-1.5 text-right font-medium">Poptávky</th>
                    <th className="py-1.5 text-right font-medium">Objednáno</th>
                    <th className="py-1.5 text-right font-medium">Úspěšnost</th>
                  </tr>
                </thead>
                <tbody>
                  {r.poptavkyPodleOsob.map((m) => (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="py-1.5">
                        {m.jmeno} <span className="text-xs text-text-muted">· {m.pozice}</span>
                      </td>
                      <td className="py-1.5 text-right">{m.poptavky}</td>
                      <td className="py-1.5 text-right">{m.objednano}</td>
                      <td className="py-1.5 text-right">
                        {m.uspesnost == null ? <span className="text-text-muted">—</span> : pct(m.uspesnost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Poptávky přijaté v období podle odpovědné osoby (obchod i vedení); úspěšnost = objednáno / uzavřené.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Po termínu */}
      <Card className={r.zakazky.poTerminu.length > 0 ? "border-red-400/50" : ""}>
        <CardHeader><CardTitle>⚠️ Akce po termínu ({r.zakazky.poTerminu.length})</CardTitle></CardHeader>
        <CardContent>
          {r.zakazky.poTerminu.length === 0 ? (
            <p className="text-sm text-text-muted">Žádná akce po termínu. 👍</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {r.zakazky.poTerminu.map((z) => (
                <li key={z.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/zakazky/${z.id}`} className="min-w-0 truncate hover:underline">
                    <span className="font-mono font-medium">{formatKod(z.kod)}</span> · {z.misto}
                  </Link>
                  <span className="text-red-600 dark:text-red-400">{z.dni} dní (do {formatCz(parseDay(z.konec))})</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Fakturace */}
      <Card>
        <CardHeader><CardTitle>💸 Ve fakturaci ({r.fakturace.polozky.length})</CardTitle></CardHeader>
        <CardContent>
          {r.fakturace.polozky.length === 0 ? (
            <p className="text-sm text-text-muted">Nic nečeká na fakturaci/proplacení.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {r.fakturace.polozky.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/zakazky/${f.id}`} className="min-w-0 truncate hover:underline">
                    <span className="font-mono font-medium">{formatKod(f.kod)}</span> · {f.popis}
                  </Link>
                  <span className={f.dni != null && f.dni > 30 ? "text-red-600 dark:text-red-400" : "text-text-muted"}>
                    {f.dni != null ? `${f.dni} dní ve fakturaci` : "bez data fakturace"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Vytížení lidí – seskupené podle oddělení */}
      <Card>
        <CardHeader><CardTitle>👥 Vytížení lidí — {obdobiCz(r.ref)}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {vytizeniSkupiny.length === 0 && <p className="text-sm text-text-muted">Žádní přiřaditelní lidé.</p>}
          {vytizeniSkupiny.map((sk) => (
            <div key={sk.nazev}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {sk.nazev} ({sk.lide.length}) · ø {pct(sk.prumer)}
              </p>
              <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
                {sk.lide.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-sm">
                    <span className="w-40 min-w-0 truncate">{v.jmeno}</span>
                    <span className="relative h-3 flex-1 overflow-hidden rounded bg-overlay">
                      <span
                        className={`absolute inset-y-0 left-0 rounded ${v.podil >= 0.85 ? "bg-red-500/80" : v.podil >= 0.5 ? "bg-link/70" : "bg-emerald-500/60"}`}
                        style={{ width: `${Math.min(100, Math.round(v.podil * 100))}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-text-muted">
                      {pct(v.podil)}{v.absenceDny > 0 ? ` · abs ${v.absenceDny}d` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-text-muted">
            Podíl pracovních dní měsíce pokrytých přiřazením na akci; „abs" = pracovní dny absence.
          </p>
        </CardContent>
      </Card>

      {/* Konstrukce */}
      <Card>
        <CardHeader><CardTitle>📐 Konstrukce — {obdobiCz(r.ref)}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Aktivní projekty" value={r.konstrukce.aktivniProjekty} />
          <MiniStat label="Dokončené úkoly" value={r.konstrukce.dokonceneUkoly} />
          <MiniStat label="Úkoly po termínu" value={r.konstrukce.poTerminuUkoly} warn={r.konstrukce.poTerminuUkoly > 0} />
        </CardContent>
      </Card>

      {/* Trend po měsících: u měsíce posledních 6, u roku všech 12 daného roku */}
      <Card>
        <CardHeader>
          <CardTitle>📈 Trend — {r.typ === "rok" ? `měsíce roku ${r.ref}` : "posledních 6 měsíců"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-2 ${r.typ === "rok" ? "grid-cols-6 sm:grid-cols-12" : "grid-cols-6"}`}>
            {r.trend.map((t) => (
              <div key={t.mesic} className="space-y-1 text-center">
                <div className={`flex h-28 items-end justify-center ${r.typ === "rok" ? "gap-px" : "gap-1"}`}>
                  <TrendSloupec hodnota={t.poptavkyPrijate} max={maxTrend} trida="bg-sky-400/70" titulek={`Přijaté poptávky: ${t.poptavkyPrijate}`} />
                  <TrendSloupec hodnota={t.poptavkyObjednane} max={maxTrend} trida="bg-emerald-500/70" titulek={`Objednáno: ${t.poptavkyObjednane}`} />
                  <TrendSloupec hodnota={t.akceZahajene} max={maxTrend} trida="bg-link/70" titulek={`Zahájené akce: ${t.akceZahajene}`} />
                  <TrendSloupec hodnota={t.akceKoncici} max={maxTrend} trida="bg-amber-500/70" titulek={`Končící akce: ${t.akceKoncici}`} />
                </div>
                <p className="text-xs text-text-muted">{t.mesic.slice(5)}/{t.mesic.slice(2, 4)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-muted">
            <LegendaBod trida="bg-sky-400/70" text="Přijaté poptávky" />
            <LegendaBod trida="bg-emerald-500/70" text="Objednáno" />
            <LegendaBod trida="bg-link/70" text="Zahájené akce" />
            <LegendaBod trida="bg-amber-500/70" text="Končící akce" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, warn, href }: { label: string; value: number; warn?: boolean; href: string }) {
  return (
    <Link href={href}>
      <Card className={`h-full transition-colors hover:bg-accent ${warn ? "border-red-400/50" : ""}`}>
        <CardHeader className="p-3 pb-1"><CardTitle className="normal-case">{label}</CardTitle></CardHeader>
        <CardContent className="p-3 pt-0"><p className="text-2xl font-bold">{value}</p></CardContent>
      </Card>
    </Link>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border border-line p-2 ${warn ? "border-red-400/50" : ""}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

function TrendSloupec({ hodnota, max, trida, titulek }: { hodnota: number; max: number; trida: string; titulek: string }) {
  const vyska = hodnota === 0 ? 2 : Math.max(6, Math.round((hodnota / max) * 100));
  return <span className={`w-3 rounded-t ${trida}`} style={{ height: `${vyska}%` }} title={titulek} />;
}

function LegendaBod({ trida, text }: { trida: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${trida}`} /> {text}
    </span>
  );
}
