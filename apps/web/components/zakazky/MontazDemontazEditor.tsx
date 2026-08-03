"use client";
// Montáž / Demontáž = zakázka k akci s příznakem typu. Přidání vytvoří
// podzakázku (objeví se na Tabuli i Ganttu, jde jí přiřazovat lidi). Seznam
// odkazuje na detail podzakázky, kde se řeší pracovníci, termíny atd.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/DateField";
import { pridatMontaz, smazatMontaz } from "@/app/(erp)/zakazky/actions";
import { MONTAZ_TYPY, MONTAZ_LABELS, type MontazTyp } from "@erp/core";
import { parseDay, formatCz } from "@/lib/zakazky/dates";

export type MontazZaznam = {
  id: string;
  typ: MontazTyp;
  kod: string;
  popis: string | null;
  zacatek: string;
  konec: string;
  stav: string;
};

export function MontazDemontazEditor({
  zakazkaId,
  zaznamy,
}: {
  zakazkaId: string;
  zaznamy: MontazZaznam[];
}) {
  const router = useRouter();
  const [typ, setTyp] = useState<MontazTyp>("MONTAZ");
  const [zakazkaRef, setZakazkaRef] = useState("");
  const [popis, setPopis] = useState("");
  const [od, setOd] = useState("");
  const [doo, setDoo] = useState("");
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function pridat() {
    setChyba(null);
    setBusy(true);
    const res = await pridatMontaz(zakazkaId, { typ, zakazkaRef, popis, od, do: doo });
    setBusy(false);
    if (!res.ok) return setChyba(res.chyba ?? "Chyba.");
    setZakazkaRef("");
    setPopis("");
    setOd("");
    setDoo("");
    router.refresh();
  }

  async function smazat(id: string) {
    if (!window.confirm("Smazat tuto montáž / demontáž?")) return;
    setBusy(true);
    await smazatMontaz(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      {chyba && <p className="err mb-2">{chyba}</p>}

      <div className="card divide-y divide-line">
        {zaznamy.length === 0 && <p className="px-4 py-3 text-sm text-text-muted">Zatím žádná montáž / demontáž.</p>}
        {zaznamy.map((z) => (
          <div key={z.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
            <span
              className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                z.typ === "MONTAZ" ? "bg-sky-600 text-white" : "bg-amber-500 text-white"
              }`}
            >
              {z.typ === "MONTAZ" ? "🔧 Montáž" : "🔩 Demontáž"}
            </span>
            <Link href={`/zakazky/${z.id}`} className="font-semibold text-link hover:underline">
              {z.popis || MONTAZ_LABELS[z.typ]}
            </Link>
            <span className="text-text-muted">
              {formatCz(parseDay(z.zacatek))} – {formatCz(parseDay(z.konec))}
            </span>
            <Link href={`/zakazky/${z.id}`} className="ml-auto text-xs text-link hover:underline">
              Přiřadit lidi →
            </Link>
            <button type="button" onClick={() => smazat(z.id)} className="text-xs text-red-500 hover:underline">
              Smazat
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-3 space-y-2 p-4">
        <p className="text-sm font-medium text-text-muted">Přidat montáž / demontáž</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="label">Typ *</label>
            <select className="field" value={typ} onChange={(e) => setTyp(e.target.value as MontazTyp)}>
              {MONTAZ_TYPY.map((t) => (
                <option key={t} value={t}>{MONTAZ_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Zakázka</label>
            <input className="field" value={zakazkaRef} onChange={(e) => setZakazkaRef(e.target.value)} placeholder="označení (nepovinné)" />
          </div>
        </div>
        <div>
          <label className="label">Popis</label>
          <input className="field" value={popis} onChange={(e) => setPopis(e.target.value)} placeholder="nepovinné" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Termín od</label>
            <DateField value={od} onChange={setOd} />
          </div>
          <div>
            <label className="label">Termín do</label>
            <DateField value={doo} onChange={setDoo} />
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Vytvoří se jako zakázka k akci – objeví se na Tabuli i Ganttu a přiřadíš jí lidi jako ostatním zakázkám k akci.
          Prázdné termíny převezmou rozsah akce.
        </p>
        <button className="btn-primary" disabled={busy} onClick={pridat}>
          {busy ? "Přidávám…" : "Přidat"}
        </button>
      </div>
    </>
  );
}
