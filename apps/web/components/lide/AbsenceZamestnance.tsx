"use client";
// Absence na kartě zaměstnance: seznam + přidání (dovolená, nemoc, lékař,
// můj den) + smazání. Zapisovat smí editor/admin. Dovolená pak blokuje
// přiřazení pracovníka k akci v daném období (Zakázky).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ABSENCE_LABELS, type AbsenceType } from "@erp/core";
import { DateField } from "@/components/DateField";
import { pridatAbsenci, smazatAbsenci } from "@/app/(erp)/konstrukce/actions";
import { parseDay, formatCz } from "@/lib/zakazky/dates";

export type AbsenceRadek = { id: string; type: AbsenceType; startDate: string; endDate: string };

export function AbsenceZamestnance({
  profileId,
  absence,
  editable,
}: {
  profileId: string;
  absence: AbsenceRadek[];
  editable: boolean;
}) {
  const router = useRouter();
  const dnes = new Date().toISOString().slice(0, 10);
  const [typ, setTyp] = useState<AbsenceType>("dovolena");
  const [od, setOd] = useState(dnes);
  const [doDne, setDoDne] = useState(dnes);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function pridat(vynutit = false) {
    setBusy(true);
    setChyba(null);
    const res = await pridatAbsenci(profileId, typ, od, doDne, vynutit);
    setBusy(false);
    if (!res.ok) {
      // Kolize s konstrukčními úkoly – po potvrzení jde uložit i tak.
      if (res.kolize && res.kolize.length > 0) {
        const popis = res.kolize.map((k) => k.s).join(", ");
        if (confirm(`Absence se kryje s: ${popis}. Uložit i tak?`)) return pridat(true);
        return;
      }
      setChyba(res.chyba ?? "Uložení se nezdařilo.");
      return;
    }
    router.refresh();
  }

  async function smazat(id: string) {
    if (!confirm("Smazat absenci?")) return;
    setBusy(true);
    await smazatAbsenci(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card p-6">
      <h2 className="mb-3 text-base font-semibold">🌴 Dovolená a absence</h2>

      {absence.length === 0 ? (
        <p className="text-sm text-text-muted">Žádné zadané absence.</p>
      ) : (
        <ul className="divide-y divide-line">
          {absence.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className={`mr-2 rounded-md px-1.5 py-0.5 text-xs font-medium ${a.type === "dovolena" ? "bg-emerald-500/15 text-emerald-600" : "bg-accent text-text-muted"}`}>
                  {ABSENCE_LABELS[a.type]}
                </span>
                {formatCz(parseDay(a.startDate))} – {formatCz(parseDay(a.endDate))}
              </span>
              {editable && (
                <button type="button" className="text-text-muted hover:text-red-500" onClick={() => smazat(a.id)} disabled={busy} aria-label="Smazat absenci">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <div>
            <label className="label">Typ</label>
            <select className="field" value={typ} onChange={(e) => setTyp(e.target.value as AbsenceType)}>
              {(Object.keys(ABSENCE_LABELS) as AbsenceType[]).map((t) => (
                <option key={t} value={t}>{ABSENCE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Od</label>
            <DateField value={od} onChange={setOd} />
          </div>
          <div>
            <label className="label">Do</label>
            <DateField value={doDne} onChange={setDoDne} />
          </div>
          <button type="button" className="btn-primary" onClick={() => pridat()} disabled={busy || !od || !doDne}>
            {busy ? "Ukládám…" : "Přidat"}
          </button>
          {chyba && <p className="err w-full">{chyba}</p>}
        </div>
      )}
      <p className="mt-3 text-xs text-text-muted">
        Po dobu <strong>dovolené</strong> nejde zaměstnance přiřadit k akci (Zakázky to zablokují).
      </p>
    </div>
  );
}
