"use client";
// Montáž / Demontáž u akce: výběr typu + nepovinná zakázka, popis a termín od–do.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/DateField";
import { pridatMontaz, smazatMontaz } from "@/app/(erp)/zakazky/actions";
import { MONTAZ_TYPY, MONTAZ_LABELS, type MontazTyp } from "@erp/core";
import { parseDay, formatCz } from "@/lib/zakazky/dates";

export type MontazZaznam = {
  id: string;
  typ: MontazTyp;
  zakazkaRef: string | null;
  popis: string | null;
  datumOd: string | null;
  datumDo: string | null;
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
    if (!window.confirm("Smazat záznam?")) return;
    setBusy(true);
    await smazatMontaz(id);
    setBusy(false);
    router.refresh();
  }

  const termin = (z: MontazZaznam) => {
    const o = z.datumOd ? formatCz(parseDay(z.datumOd)) : null;
    const d = z.datumDo ? formatCz(parseDay(z.datumDo)) : null;
    if (o && d) return `${o} – ${d}`;
    if (o) return `od ${o}`;
    if (d) return `do ${d}`;
    return null;
  };

  return (
    <>
      {chyba && <p className="err mb-2">{chyba}</p>}

      <div className="card divide-y divide-line">
        {zaznamy.length === 0 && <p className="px-4 py-3 text-sm text-text-muted">Zatím žádné záznamy.</p>}
        {zaznamy.map((z) => (
          <div key={z.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
            <span
              className={`badge ${z.typ === "MONTAZ" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}
            >
              {MONTAZ_LABELS[z.typ]}
            </span>
            {z.zakazkaRef && <span className="font-medium">{z.zakazkaRef}</span>}
            {z.popis && <span className="text-text-muted">{z.popis}</span>}
            {termin(z) && <span className="text-text-muted">· {termin(z)}</span>}
            <button
              type="button"
              onClick={() => smazat(z.id)}
              className="ml-auto text-red-500 hover:underline"
            >
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
            <input className="field" value={zakazkaRef} onChange={(e) => setZakazkaRef(e.target.value)} placeholder="nepovinné" />
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
        <button className="btn-primary" disabled={busy} onClick={pridat}>
          {busy ? "Přidávám…" : "Přidat"}
        </button>
      </div>
    </>
  );
}
