"use client";
// Archiv Konstrukce: řádky pod sebou, Obnovit, Smazat archiv (s potvrzením).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KONSTRUKCE_LABELS } from "@erp/core";
import { obnovitProjekt, obnovitUkol, smazatArchiv } from "@/app/(erp)/konstrukce/actions";
import { formatDateTime } from "@/lib/format";

export type ArchivRadek = {
  typ: "projekt" | "ukol";
  id: string;
  nazev: string;
  projekt: string; // u úkolu název projektu; u projektu počet úkolů
  kdo: string;
  kdy: string | null;
};

export function ArchivList({ radky, editable }: { radky: ArchivRadek[]; editable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function obnovit(r: ArchivRadek) {
    setBusy(true);
    setChyba(null);
    const res = r.typ === "projekt" ? await obnovitProjekt(r.id) : await obnovitUkol(r.id);
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    router.refresh();
  }

  async function smazatVse() {
    if (!window.confirm("Nenávratně smazat VŠECHNY archivní záznamy (projekty i úkoly)?")) return;
    setBusy(true);
    setChyba(null);
    const res = await smazatArchiv();
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Archiv</h1>
        {editable && radky.length > 0 && (
          <button className="btn-danger" onClick={smazatVse} disabled={busy}>
            {KONSTRUKCE_LABELS.deleteArchive}
          </button>
        )}
      </div>
      {chyba && <p className="err">{chyba}</p>}

      {radky.length === 0 ? (
        <p className="text-sm text-text-muted">Archiv je prázdný.</p>
      ) : (
        <div className="card divide-y divide-line">
          {radky.map((r) => (
            <div key={`${r.typ}:${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className={`badge ${r.typ === "projekt" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                {r.typ === "projekt" ? "Projekt" : "Úkol"}
              </span>
              <span className="font-medium">{r.nazev}</span>
              <span className="text-text-muted">{r.projekt}</span>
              <span className="ml-auto text-xs text-text-muted">
                {r.kdo}
                {r.kdy ? ` · ${formatDateTime(r.kdy)}` : ""}
              </span>
              {editable && (
                <button className="btn-ghost" onClick={() => obnovit(r)} disabled={busy}>
                  {KONSTRUKCE_LABELS.restore}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
