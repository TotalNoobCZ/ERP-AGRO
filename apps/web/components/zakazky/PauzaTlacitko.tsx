"use client";
// Tlačítko ⏸/▶ na akci: pozastavení (datum + povinný důvod, kaskáda na
// podzakázky, lidé se uvolní pro jiné akce) a obnovení (posun konce o zbylé
// dny). Když jsou lidé akce mezitím obsazení jinde, obnovení nejdřív ukáže
// dialog s hledáním náhrady (osobu na přiřazení jde vyměnit, období zůstává).
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ODDELENI_LABELS, type Oddeleni } from "@erp/core";
import { DateField } from "@/components/DateField";
import {
  pauzaAkce,
  obnovaAkce,
  zjistitKonfliktyObnoveni,
  seznamNahradniku,
  type ObnovaKonflikt,
} from "@/app/(erp)/zakazky/actions";
import { parseDay, formatCz } from "@/lib/zakazky/dates";

type Nahradnik = { id: string; name: string; oddeleni: string | null };

export function PauzaTlacitko({
  zakazkaId,
  kod,
  stav,
  editable,
}: {
  zakazkaId: string;
  kod: string;
  stav: string;
  editable: boolean;
}) {
  const router = useRouter();
  const dnes = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  // pauza dialog
  const [pauzaOpen, setPauzaOpen] = useState(false);
  const [datum, setDatum] = useState(dnes);
  const [duvod, setDuvod] = useState("");
  // obnova dialog
  const [obnovaOpen, setObnovaOpen] = useState(false);
  const [konflikty, setKonflikty] = useState<ObnovaKonflikt[]>([]);
  const [nahradnici, setNahradnici] = useState<Nahradnik[]>([]);
  const [vybrane, setVybrane] = useState<Record<string, string>>({}); // prirazeniId → osobaId ("" = ponechat)

  if (!editable || (stav !== "AKTIVNI" && stav !== "POZASTAVENO")) return null;

  async function potvrditPauzu() {
    setBusy(true);
    setChyba(null);
    const res = await pauzaAkce(zakazkaId, datum, duvod);
    setBusy(false);
    if (!res.ok) return setChyba(res.chyba ?? "Nepovedlo se.");
    setPauzaOpen(false);
    setDuvod("");
    router.refresh();
  }

  async function otevritObnovu() {
    setBusy(true);
    setChyba(null);
    const [resK, lide] = await Promise.all([zjistitKonfliktyObnoveni(zakazkaId), seznamNahradniku()]);
    setBusy(false);
    if (!resK.ok) return setChyba(resK.chyba ?? "Nepovedlo se.");
    setKonflikty(resK.konflikty ?? []);
    setNahradnici(lide);
    setVybrane({});
    setDatum(dnes);
    setObnovaOpen(true);
  }

  async function potvrditObnovu() {
    setBusy(true);
    setChyba(null);
    const nahrady = Object.entries(vybrane)
      .filter(([, osobaId]) => osobaId)
      .map(([prirazeniId, novaOsobaId]) => ({ prirazeniId, novaOsobaId }));
    const res = await obnovaAkce(zakazkaId, datum, nahrady);
    setBusy(false);
    if (!res.ok) return setChyba(res.chyba ?? "Nepovedlo se.");
    setObnovaOpen(false);
    router.refresh();
  }

  const stopo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {stav === "AKTIVNI" ? (
        <button
          type="button"
          onClick={(e) => {
            stopo(e);
            setDatum(dnes);
            setChyba(null);
            setPauzaOpen(true);
          }}
          disabled={busy}
          data-tip="Pozastavit akci (i zakázky k akci); lidé se uvolní pro jiné akce"
          aria-label="Pozastavit akci"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-[10px] text-text-muted transition hover:border-amber-400/70 hover:text-amber-500"
        >
          ❚❚
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            stopo(e);
            otevritObnovu();
          }}
          disabled={busy}
          data-tip="Obnovit akci (i zakázky k akci); lidé se znovu přiřadí"
          aria-label="Obnovit akci"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-[11px] text-text-muted transition hover:border-emerald-400/70 hover:text-emerald-500"
        >
          ▶
        </button>
      )}

      {/* Dialogy jdou portálem do <body> – karta akce může být zašedlá
          (grayscale/opacity) a CSS filtr by jinak vybledl i overlay. */}
      {pauzaOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={stopo}>
          <div className="card w-full max-w-md p-6">
            <h2 className="text-base font-semibold">⏸ Pozastavit akci <span className="font-mono">{kod}</span></h2>
            <p className="mt-1 text-sm text-text-muted">
              Pozastaví se i všechny zakázky k akci. Lidé u akce zůstanou napsaní, ale uvolní se
              pro jiné akce. Po obnovení se konec posune o zbývající dny.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Datum pozastavení</label>
                <DateField value={datum} onChange={setDatum} />
              </div>
              <div>
                <label className="label">Důvod (povinný)</label>
                <input className="field" value={duvod} onChange={(e) => setDuvod(e.target.value)} autoFocus placeholder="Proč se akce pozastavuje" />
              </div>
            </div>
            {chyba && <p className="err mt-2">{chyba}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPauzaOpen(false)} disabled={busy}>Zrušit</button>
              <button type="button" className="btn-primary" onClick={potvrditPauzu} disabled={busy || duvod.trim().length < 3}>
                {busy ? "Ukládám…" : "Pozastavit"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Dialog obnovení (s hledáním náhrad při konfliktech) */}
      {obnovaOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={stopo}>
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="text-base font-semibold">▶ Obnovit akci <span className="font-mono">{kod}</span></h2>
            <p className="mt-1 text-sm text-text-muted">
              Obnoví se i zakázky k akci; konec se posune o zbývající dny od data obnovení.
            </p>
            <div className="mt-4">
              <label className="label">Datum obnovení</label>
              <DateField value={datum} onChange={setDatum} />
            </div>

            {konflikty.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-400/50 bg-amber-500/10 p-3">
                <p className="text-sm font-medium">⚠️ Lidé mezitím obsazení jinde ({konflikty.length})</p>
                <p className="mb-2 text-xs text-text-muted">
                  Vyber náhradu (převezme stejné období), nebo nech „ponechat" – člověk pak bude na obou akcích.
                </p>
                <div className="space-y-2">
                  {konflikty.map((k) => (
                    <div key={k.prirazeniId} className="rounded-md border border-line bg-surface p-2 text-sm">
                      <p className="font-medium">
                        {k.jmeno} <span className="font-normal text-text-muted">· {k.zakazkaKod} · {formatCz(parseDay(k.od))} – {formatCz(parseDay(k.do))}</span>
                      </p>
                      <p className="text-xs text-text-muted">{k.konflikt}</p>
                      <select
                        className="field mt-1.5"
                        value={vybrane[k.prirazeniId] ?? ""}
                        onChange={(e) => setVybrane((prev) => ({ ...prev, [k.prirazeniId]: e.target.value }))}
                      >
                        <option value="">— ponechat (bude na obou akcích) —</option>
                        {nahradnici
                          .filter((n) => n.id !== k.osobaId)
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name}{n.oddeleni ? ` (${ODDELENI_LABELS[n.oddeleni as Oddeleni] ?? n.oddeleni})` : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {konflikty.length === 0 && (
              <p className="mt-3 text-sm text-emerald-500">Všichni lidé akce jsou volní – přiřadí se zpět. 👍</p>
            )}

            {chyba && <p className="err mt-2">{chyba}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setObnovaOpen(false)} disabled={busy}>Zrušit</button>
              <button type="button" className="btn-primary" onClick={potvrditObnovu} disabled={busy}>
                {busy ? "Ukládám…" : "Obnovit akci"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
