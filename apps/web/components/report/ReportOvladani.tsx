"use client";
// Ovládání období reportu (Měsíc/Rok, šipky, export). Při přepínání se přes
// obsah zobrazí načítací kolečko uprostřed obrazovky, dokud nedorazí nová data.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

const MESICE_CZ = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

/** „YYYY-MM" → „srpen 2026", „YYYY" → „rok 2026" */
function obdobiCz(ref: string): string {
  if (/^\d{4}$/.test(ref)) return `rok ${ref}`;
  const [y, m] = ref.split("-").map(Number);
  return `${MESICE_CZ[(m ?? 1) - 1]} ${y}`;
}

/** Posun ref o `o` období: měsíc o měsíce, rok o roky. */
function posunRef(ref: string, o: number): string {
  if (/^\d{4}$/.test(ref)) return String(Number(ref) + o);
  const [y, m] = ref.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + o, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ReportOvladani({ refObdobi, typ, dnes }: { refObdobi: string; typ: "mesic" | "rok"; dnes: string }) {
  const router = useRouter();
  const [nacita, startTransition] = useTransition();

  function prejit(ref: string) {
    startTransition(() => router.push(`/report?ref=${ref}`));
  }

  const refMesic = typ === "mesic" ? refObdobi : refObdobi === dnes.slice(0, 4) ? dnes.slice(0, 7) : `${refObdobi}-01`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => prejit(refMesic)}
            className={`btn-ghost ${typ === "mesic" ? "border-link text-link" : "border-transparent"}`}
          >
            Měsíc
          </button>
          <button
            type="button"
            onClick={() => prejit(refObdobi.slice(0, 4))}
            className={`btn-ghost ${typ === "rok" ? "border-link text-link" : "border-transparent"}`}
          >
            Rok
          </button>
        </div>
        <Link href={`/report/tisk?ref=${refObdobi}&print=1`} className="btn-ghost">🖨 Export do PDF</Link>
        <button type="button" onClick={() => prejit(posunRef(refObdobi, -1))} className="btn-ghost" aria-label="Předchozí období">
          ◀
        </button>
        <span className="min-w-28 text-center text-sm font-medium capitalize">{obdobiCz(refObdobi)}</span>
        <button type="button" onClick={() => prejit(posunRef(refObdobi, 1))} className="btn-ghost" aria-label="Další období">
          ▶
        </button>
      </div>

      {nacita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-6 py-4 text-text-muted shadow-lg">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-link" />
            Načítám…
          </div>
        </div>
      )}
    </>
  );
}
