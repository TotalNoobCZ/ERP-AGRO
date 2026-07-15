"use client";
// Dialog člena týmu (klik na dlaždici): jeho vlastní Gantt + editace absencí.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ABSENCE_TYPES, ABSENCE_LABELS, type AbsenceType } from "@erp/core";
import { userColor } from "@erp/ui";
import { pridatAbsenci, smazatAbsenci, type Kolize } from "@/app/(erp)/konstrukce/actions";
import { formatDen } from "@/lib/format";
import Gantt, { ABSENCE_BARVY } from "./Gantt";
import { DateField } from "@/components/DateField";
import { KolizeDialog } from "./dialogs";
import type { Absence, Clen, Ukol } from "./types";

export function MemberDialog({
  clen,
  ukoly,
  absence,
  editable,
  onClose,
  onTaskClick,
}: {
  clen: Clen;
  ukoly: Ukol[];
  absence: Absence[];
  editable: boolean;
  onClose: () => void;
  onTaskClick: (taskId: string) => void;
}) {
  const router = useRouter();
  const [typ, setTyp] = useState<AbsenceType>("dovolena");
  const [od, setOd] = useState("");
  const [doo, setDoo] = useState("");
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [kolize, setKolize] = useState<Kolize[] | null>(null);

  async function pridat(vynutit = false) {
    setBusy(true);
    setChyba(null);
    const res = await pridatAbsenci(clen.id, typ, od, doo, vynutit);
    setBusy(false);
    if (!res.ok) {
      if (res.kolize) {
        setKolize(res.kolize);
        return;
      }
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setKolize(null);
    setOd("");
    setDoo("");
    router.refresh();
  }

  async function smazat(id: string) {
    if (!window.confirm("Smazat absenci?")) return;
    await smazatAbsenci(id);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-h-[90vh] w-full max-w-4xl space-y-4 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: userColor(clen.colorIndex) }} />
            {clen.name}
          </h2>
          <button className="text-text-muted hover:text-text" onClick={onClose} aria-label="Zavřít">✕</button>
        </div>

        {/* Osobní Gantt (jen tento člen) */}
        <Gantt
          clenove={[clen]}
          ukoly={ukoly}
          absence={absence}
          editable={editable}
          onTaskClick={onTaskClick}
          mesicu={2}
        />

        {/* Absence */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Absence</h3>
          <div className="divide-y divide-line rounded-md border border-line">
            {absence.length === 0 && <p className="px-3 py-2 text-sm text-text-muted">Žádné absence.</p>}
            {absence.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: ABSENCE_BARVY[a.type] ?? "#94a3b8" }} />
                <span className="font-medium">{ABSENCE_LABELS[a.type as AbsenceType] ?? a.type}</span>
                <span className="text-text-muted">{formatDen(a.startDate)} – {formatDen(a.endDate)}</span>
                {editable && (
                  <button className="ml-auto text-xs text-red-500 hover:underline" onClick={() => smazat(a.id)}>
                    smazat
                  </button>
                )}
              </div>
            ))}
          </div>

          {editable && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Typ</label>
                <select className="field" value={typ} onChange={(e) => setTyp(e.target.value as AbsenceType)}>
                  {ABSENCE_TYPES.map((t) => (
                    <option key={t} value={t}>{ABSENCE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Od</label>
                <DateField value={od} onChange={setOd} />
              </div>
              <div>
                <label className="label">Do (včetně)</label>
                <DateField value={doo} onChange={setDoo} />
              </div>
              <button className="btn-primary" onClick={() => pridat(false)} disabled={busy || !od || !doo}>
                {busy ? "Ukládám…" : "Přidat absenci"}
              </button>
              {chyba && <p className="err w-full">{chyba}</p>}
            </div>
          )}
        </section>
      </div>

      {kolize && (
        <KolizeDialog
          kolize={kolize}
          busy={busy}
          onIgnorovat={() => pridat(true)}
          onZrusit={() => setKolize(null)}
        />
      )}
    </div>
  );
}
