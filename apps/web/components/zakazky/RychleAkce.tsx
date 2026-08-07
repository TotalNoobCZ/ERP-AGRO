"use client";
// Rychlé akce na kartě akce (tabule): ◆ přidat milník, ＋ přidat zakázku
// k akci, 💬 přidat poznámku – malá okénka bez otvírání detailu.
// Dialogy jdou portálem do <body> (karta může být zašedlá – pozastavená).
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MILNIK_TYPY_PREDVOLBA, MILNIK_LABELS, type TypMilniku } from "@erp/core";
import { DateField } from "@/components/DateField";
import { pridatMilnik, vytvoritPodzakazku, pridatPoznamku } from "@/app/(erp)/zakazky/actions";

type Dialog = "milnik" | "podzakazka" | "poznamka" | null;

export function RychleAkce({
  zakazkaId,
  kod,
  editable,
  jePodzakazka = false,
  /** Montáž/demontáž má jen vlastní (pojmenované) milníky. */
  jenVlastniMilniky = false,
  /** Ikonky pod sebou (sloupec u pravého okraje karty). */
  svisle = false,
}: {
  zakazkaId: string;
  kod: string;
  editable: boolean;
  jePodzakazka?: boolean;
  jenVlastniMilniky?: boolean;
  svisle?: boolean;
}) {
  const router = useRouter();
  const dnes = new Date().toISOString().slice(0, 10);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  // milník
  const [typ, setTyp] = useState<string>(jenVlastniMilniky ? "VLASTNI" : MILNIK_TYPY_PREDVOLBA[0]!);
  const [nazev, setNazev] = useState("");
  const [datum, setDatum] = useState(dnes);
  // podzakázka
  const [cislo, setCislo] = useState("");
  const [popis, setPopis] = useState("");
  // poznámka
  const [text, setText] = useState("");

  if (!editable) return null;

  const stopo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  function otevrit(e: React.MouseEvent, d: Dialog) {
    stopo(e);
    setChyba(null);
    setDatum(dnes);
    setDialog(d);
  }

  function zavrit() {
    setDialog(null);
    setNazev("");
    setCislo("");
    setPopis("");
    setText("");
  }

  async function ulozit() {
    setBusy(true);
    setChyba(null);
    let res: { ok: boolean; chyba?: string };
    if (dialog === "milnik") {
      res = await pridatMilnik(zakazkaId, { typ, nazev: typ === "VLASTNI" ? nazev : undefined, datum });
    } else if (dialog === "podzakazka") {
      res = await vytvoritPodzakazku(zakazkaId, cislo, popis);
    } else {
      res = await pridatPoznamku(zakazkaId, text);
    }
    setBusy(false);
    if (!res.ok) return setChyba(res.chyba ?? "Nepovedlo se.");
    zavrit();
    router.refresh();
  }

  const btn =
    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-[11px] text-text-muted transition hover:border-link hover:text-link";

  return (
    <>
      <span className={svisle ? "flex flex-col items-center gap-2" : "inline-flex items-center gap-2"}>
        {!jePodzakazka && (
          <button
            type="button"
            className={`${btn} !text-emerald-500 hover:border-emerald-400/70 hover:!text-emerald-400`}
            onClick={(e) => otevrit(e, "podzakazka")}
            data-tip="Přidat zakázku k akci"
            aria-label="Přidat zakázku k akci"
          >
            ＋
          </button>
        )}
        <button type="button" className={btn} onClick={(e) => otevrit(e, "milnik")} data-tip="Přidat milník" aria-label="Přidat milník">
          ◆
        </button>
        <button type="button" className={btn} onClick={(e) => otevrit(e, "poznamka")} data-tip="Přidat poznámku" aria-label="Přidat poznámku">
          💬
        </button>
      </span>

      {dialog &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={stopo}>
            <div className="card w-full max-w-md p-6">
              {dialog === "milnik" && (
                <>
                  <h2 className="text-base font-semibold">◆ Přidat milník <span className="font-mono">{kod}</span></h2>
                  <div className="mt-4 space-y-3">
                    {!jenVlastniMilniky && (
                      <div>
                        <label className="label">Typ milníku</label>
                        <select className="field" value={typ} onChange={(e) => setTyp(e.target.value)}>
                          {MILNIK_TYPY_PREDVOLBA.map((t) => (
                            <option key={t} value={t}>{MILNIK_LABELS[t as TypMilniku]}</option>
                          ))}
                          <option value="VLASTNI">Vlastní…</option>
                        </select>
                      </div>
                    )}
                    {typ === "VLASTNI" && (
                      <div>
                        <label className="label">Název milníku</label>
                        <input className="field" value={nazev} onChange={(e) => setNazev(e.target.value)} autoFocus placeholder="Např. Předání dokumentace" />
                      </div>
                    )}
                    <div>
                      <label className="label">Datum</label>
                      <DateField value={datum} onChange={setDatum} />
                    </div>
                  </div>
                </>
              )}

              {dialog === "podzakazka" && (
                <>
                  <h2 className="text-base font-semibold">＋ Zakázka k akci <span className="font-mono">{kod}</span></h2>
                  <p className="mt-1 text-sm text-text-muted">Místo, termíny a prioritu zdědí od hlavní akce.</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="label">Číslo zakázky (povinné)</label>
                      <input className="field" value={cislo} onChange={(e) => setCislo(e.target.value)} autoFocus placeholder="Např. 826002" />
                    </div>
                    <div>
                      <label className="label">Popis</label>
                      <input className="field" value={popis} onChange={(e) => setPopis(e.target.value)} placeholder="Co se v zakázce dělá" />
                    </div>
                  </div>
                </>
              )}

              {dialog === "poznamka" && (
                <>
                  <h2 className="text-base font-semibold">💬 Poznámka k akci <span className="font-mono">{kod}</span></h2>
                  {/* „komiksová bublina" s ocáskem */}
                  <div className="relative mt-4 rounded-2xl border border-line bg-accent/40 p-3">
                    <span className="absolute -bottom-2 left-6 h-4 w-4 rotate-45 border-b border-r border-line bg-accent/40" />
                    <textarea
                      className="field min-h-24 w-full resize-y border-0 bg-transparent p-0 focus:ring-0"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      autoFocus
                      placeholder="Napiš poznámku…"
                    />
                  </div>
                </>
              )}

              {chyba && <p className="err mt-2">{chyba}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={zavrit} disabled={busy}>Zrušit</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={ulozit}
                  disabled={
                    busy ||
                    (dialog === "milnik" && typ === "VLASTNI" && !nazev.trim()) ||
                    (dialog === "podzakazka" && !cislo.trim()) ||
                    (dialog === "poznamka" && !text.trim())
                  }
                >
                  {busy ? "Ukládám…" : "Uložit"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
