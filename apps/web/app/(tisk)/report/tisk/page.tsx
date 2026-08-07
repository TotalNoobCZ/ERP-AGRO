// Tiskový export reportu pro vedení (PDF přes tisk prohlížeče).
import { Fragment } from "react";
import { formatKod } from "@erp/core";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { nactiReport, smiVidetReport, vytizeniPodleOddeleni } from "@/lib/report";
import { PrintButton } from "@/components/PrintButton";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const MESICE_CZ = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const pct = (x: number) => `${Math.round(x * 100)} %`;

export default async function ReportTiskPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; print?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!smiVidetReport(profile?.role)) redirect("/");

  const sp = await searchParams;
  const r = await nactiReport(sp.ref);
  const obdobiNazev =
    r.typ === "rok"
      ? `rok ${r.ref}`
      : `${MESICE_CZ[(Number(r.ref.slice(5)) || 1) - 1]} ${r.ref.slice(0, 4)}`;

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black">
      <PrintButton auto={sp?.print === "1"} />
      <div className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold">Report pro vedení — {obdobiNazev}</h1>
        <p className="text-sm text-gray-500">
          Období {formatCz(parseDay(r.obdobi.od))} – {formatCz(parseDay(r.obdobi.do))} · vytištěno {formatDate(new Date())}
        </p>
      </div>

      {/* Souhrn */}
      <table className="mb-5 w-full border-collapse text-sm">
        <tbody>
          <tr className="[&>td]:border [&>td]:border-gray-300 [&>td]:p-2 [&>td]:text-center">
            <td><strong className="text-lg">{r.zakazky.aktivni}</strong><br />Aktivní akce</td>
            <td><strong className="text-lg">{r.zakazky.poTerminu.length}</strong><br />Po termínu</td>
            <td><strong className="text-lg">{r.fakturace.polozky.length}</strong><br />Ve fakturaci</td>
            <td><strong className="text-lg">{r.poptavky.otevreneCelkem}</strong><br />Otevřené poptávky</td>
            <td><strong className="text-lg">{r.konstrukce.aktivniProjekty}</strong><br />Aktivní projekty</td>
            <td><strong className="text-lg">{r.konstrukce.poTerminuUkoly}</strong><br />Úkoly po termínu</td>
          </tr>
        </tbody>
      </table>

      <Sekce nazev="Poptávky">
        <p>
          Přijaté: <strong>{r.poptavky.prijate}</strong> · Objednáno: <strong>{r.poptavky.objednano}</strong> · Zamítnuto:{" "}
          <strong>{r.poptavky.zamitnuto}</strong> · Úspěšnost uzavřených:{" "}
          <strong>{r.poptavky.uspesnost == null ? "—" : pct(r.poptavky.uspesnost)}</strong>
        </p>
        {r.poptavky.otevrene.length > 0 && (
          <p className="text-gray-600">
            Otevřené teď: {r.poptavky.otevrene.map((s) => `${s.label} ${s.pocet}`).join(" · ")}
          </p>
        )}
      </Sekce>

      <Sekce nazev="Akce (zakázky)">
        <p>
          Zahájené: <strong>{r.zakazky.zahajene}</strong> · Končící: <strong>{r.zakazky.koncici}</strong> · Prodloužení termínu:{" "}
          <strong>{r.zakazky.prodlouzeni.length}</strong> · Běží: <strong>{r.zakazky.aktivni}</strong> · Pozastaveno:{" "}
          <strong>{r.zakazky.pozastaveno}</strong>
        </p>
        {r.zakazky.prodlouzeni.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-gray-600">
            {r.zakazky.prodlouzeni.map((p, i) => (
              <li key={i}>
                <span className="font-mono">{formatKod(p.kod)}</span>: {formatCz(parseDay(p.staryKonec))} → {formatCz(parseDay(p.novyKonec))} — {p.duvod}
              </li>
            ))}
          </ul>
        )}
      </Sekce>

      <Sekce nazev={`Akce po termínu (${r.zakazky.poTerminu.length})`}>
        {r.zakazky.poTerminu.length === 0 ? (
          <p className="text-gray-600">Žádná akce po termínu.</p>
        ) : (
          <ul className="list-inside list-disc">
            {r.zakazky.poTerminu.map((z) => (
              <li key={z.id}>
                <span className="font-mono">{formatKod(z.kod)}</span> · {z.misto} — <strong>{z.dni} dní</strong> (termín {formatCz(parseDay(z.konec))})
              </li>
            ))}
          </ul>
        )}
      </Sekce>

      <Sekce nazev={`Ve fakturaci (${r.fakturace.polozky.length})`}>
        {r.fakturace.polozky.length === 0 ? (
          <p className="text-gray-600">Nic nečeká na fakturaci/proplacení.</p>
        ) : (
          <ul className="list-inside list-disc">
            {r.fakturace.polozky.map((f) => (
              <li key={f.id}>
                <span className="font-mono">{formatKod(f.kod)}</span> · {f.popis} — {f.dni != null ? `${f.dni} dní ve fakturaci` : "bez data fakturace"}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-gray-600">Proplaceno celkem: {r.fakturace.proplacenoCelkem}</p>
      </Sekce>

      <Sekce nazev="Akce podle odpovědných osob">
        {r.akcePodleOsob.length === 0 ? (
          <p className="text-gray-600">Žádné akce s odpovědnou osobou v období.</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {r.akcePodleOsob.map((m) => (
                <tr key={m.id} className="[&>td]:border-b [&>td]:border-gray-200 [&>td]:py-1">
                  <td>
                    {m.jmeno} <span className="text-gray-500">({m.pozice})</span>
                  </td>
                  <td className="text-right font-medium">{m.akce} akcí</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sekce>

      <Sekce nazev="Poptávky podle odpovědných osob (vč. úspěšnosti objednání)">
        {r.poptavkyPodleOsob.length === 0 ? (
          <p className="text-gray-600">Žádné poptávky s odpovědnou osobou v období.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="[&>th]:border-b [&>th]:border-gray-300 [&>th]:py-1 [&>th]:text-left [&>th]:font-medium">
                <th>Jméno</th>
                <th className="!text-right">Poptávky</th>
                <th className="!text-right">Objednáno</th>
                <th className="!text-right">Zamítnuto</th>
                <th className="!text-right">Úspěšnost</th>
              </tr>
            </thead>
            <tbody>
              {r.poptavkyPodleOsob.map((m) => (
                <tr key={m.id} className="[&>td]:border-b [&>td]:border-gray-200 [&>td]:py-1">
                  <td>
                    {m.jmeno} <span className="text-gray-500">({m.pozice})</span>
                  </td>
                  <td className="text-right">{m.poptavky}</td>
                  <td className="text-right">{m.objednano}</td>
                  <td className="text-right">{m.zamitnuto}</td>
                  <td className="text-right">{m.uspesnost == null ? "—" : pct(m.uspesnost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sekce>

      <Sekce nazev="Vytížení lidí (podíl pracovních dní s přiřazením na akci)">
        <table className="w-full border-collapse">
          <tbody>
            {vytizeniPodleOddeleni(r.vytizeni).map((sk) => (
              <Fragment key={sk.nazev}>
                <tr>
                  <td colSpan={3} className="pb-1 pt-2 font-semibold">
                    {sk.nazev} ({sk.lide.length}) · průměr {pct(sk.prumer)}
                  </td>
                </tr>
                {sk.lide.map((v) => (
                  <tr key={v.id} className="[&>td]:border-b [&>td]:border-gray-200 [&>td]:py-1">
                    <td className="w-48">{v.jmeno}</td>
                    <td>
                      <div className="h-2.5 w-full max-w-64 rounded bg-gray-200">
                        <div className="h-2.5 rounded bg-gray-600" style={{ width: `${Math.min(100, Math.round(v.podil * 100))}%` }} />
                      </div>
                    </td>
                    <td className="w-32 text-right text-gray-600">
                      {pct(v.podil)}{v.absenceDny > 0 ? ` · abs ${v.absenceDny}d` : ""}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Sekce>

      <Sekce nazev="Konstrukce">
        <p>
          Aktivní projekty: <strong>{r.konstrukce.aktivniProjekty}</strong> · Dokončené úkoly v období:{" "}
          <strong>{r.konstrukce.dokonceneUkoly}</strong> · Úkoly po termínu: <strong>{r.konstrukce.poTerminuUkoly}</strong>
        </p>
      </Sekce>

      <Sekce nazev={r.typ === "rok" ? `Trend – měsíce roku ${r.ref}` : "Trend – posledních 6 měsíců"}>
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="[&>th]:border [&>th]:border-gray-300 [&>th]:p-1.5 [&>th]:font-medium">
              <th className="text-left">Měsíc</th>
              {r.trend.map((t) => <th key={t.mesic}>{t.mesic.slice(5)}/{t.mesic.slice(2, 4)}</th>)}
            </tr>
          </thead>
          <tbody className="[&_td]:border [&_td]:border-gray-300 [&_td]:p-1.5">
            <tr><td className="text-left">Přijaté poptávky</td>{r.trend.map((t) => <td key={t.mesic}>{t.poptavkyPrijate}</td>)}</tr>
            <tr><td className="text-left">Objednáno</td>{r.trend.map((t) => <td key={t.mesic}>{t.poptavkyObjednane}</td>)}</tr>
            <tr><td className="text-left">Zahájené akce</td>{r.trend.map((t) => <td key={t.mesic}>{t.akceZahajene}</td>)}</tr>
            <tr><td className="text-left">Končící akce</td>{r.trend.map((t) => <td key={t.mesic}>{t.akceKoncici}</td>)}</tr>
          </tbody>
        </table>
      </Sekce>
    </div>
  );
}

function Sekce({ nazev, children }: { nazev: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 break-inside-avoid text-sm">
      <h2 className="mb-1 border-b border-gray-200 pb-0.5 font-semibold">{nazev}</h2>
      {children}
    </div>
  );
}
