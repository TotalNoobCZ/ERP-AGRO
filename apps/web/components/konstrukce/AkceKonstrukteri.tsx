"use client";
// Přehled akcí s konstruktéry: karta akce (všichni konstruktéři napříč jejími
// zakázkami) + sbalitelný seznam zakázek k akci, u každé její konstruktéři.
// Šéfkonstruktér/vedoucí/admin může akci označit „konstrukce není třeba" –
// zmizí z modulu Konstrukce (sekce dole umožňuje vrácení).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { userColor } from "@erp/ui";
import { formatDen } from "@/lib/format";
import { usePersistentSet } from "@/lib/usePersistentSet";
import { oznacitKonstrukceNetreba, vratitDoKonstrukce } from "@/app/(erp)/konstrukce/actions";
import type { Osoba } from "@/lib/zakazky/lide";

export type AkceZak = {
  id: string;
  kod: string;
  popis: string | null;
  mistoPlneni: string;
  zacatek: string;
  konecAktualni: string;
  konstrukteri: Osoba[];
};
export type AkceSkupina = { akce: AkceZak; konstrukteriAkce: Osoba[]; deti: AkceZak[] };

function Chips({ lide }: { lide: Osoba[] }) {
  if (lide.length === 0) return <span className="text-xs text-text-muted">bez konstruktérů</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {lide.map((o) => (
        <span
          key={o.id}
          className="rounded-md px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: userColor(o.colorIndex, o.colorHex), color: "#16181b" }}
        >
          {o.name}
        </span>
      ))}
    </span>
  );
}

function Karta({ z, lide, onVyradit }: { z: AkceZak; lide: Osoba[]; onVyradit?: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/zakazky/${z.id}`} className="block min-w-0 hover:underline">
          <p className="font-bold">{z.kod}</p>
          <p className="text-xs text-text-muted">{z.popis || z.mistoPlneni}</p>
        </Link>
        {onVyradit && (
          <button
            type="button"
            onClick={onVyradit}
            className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[11px] text-text-muted transition hover:border-red-400/60 hover:text-red-500"
            title="Označit, že k této akci není konstrukce třeba – akce zmizí z modulu Konstrukce (v ostatních modulech zůstane)."
          >
            🚫 Není třeba
          </button>
        )}
      </div>
      <p className="mb-2 text-[11px] text-text-muted">
        {formatDen(z.zacatek)} – {formatDen(z.konecAktualni)}
      </p>
      <Chips lide={lide} />
    </div>
  );
}

export function AkceKonstrukteri({
  skupiny,
  vyrazene = [],
  smiVyradit = false,
}: {
  skupiny: AkceSkupina[];
  /** akce označené „konstrukce není třeba" (jdou vrátit) */
  vyrazene?: AkceZak[];
  smiVyradit?: boolean;
}) {
  const { has: jeSbaleno, toggle } = usePersistentSet("erp_konstrukce_prehled_sbaleno");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function vyradit(z: AkceZak) {
    if (!confirm(`Označit akci ${z.kod} jako „konstrukce není třeba"? Zmizí z modulu Konstrukce; v ostatních modulech zůstane.`)) return;
    setBusy(true);
    setChyba(null);
    const res = await oznacitKonstrukceNetreba(z.id);
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    router.refresh();
  }

  async function vratit(z: AkceZak) {
    setBusy(true);
    setChyba(null);
    const res = await vratitDoKonstrukce(z.id);
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    router.refresh();
  }

  if (skupiny.length === 0 && vyrazene.length === 0) {
    return <p className="text-sm text-text-muted">Žádné otevřené akce.</p>;
  }

  return (
    <div className="space-y-3">
      {chyba && <p className="err">{chyba}</p>}
      <div className="columns-1 gap-3 md:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
        {skupiny.map((g) => {
          const zavreno = jeSbaleno(g.akce.id);
          return (
            <div key={g.akce.id}>
              <Karta
                z={g.akce}
                lide={g.konstrukteriAkce}
                onVyradit={smiVyradit && !busy ? () => vyradit(g.akce) : undefined}
              />
              {g.deti.length > 0 && (
                <div className="ml-3 mt-1 border-l-2 border-link/40 pl-3">
                  <button
                    type="button"
                    onClick={() => toggle(g.akce.id)}
                    className="flex items-center gap-1 py-1 text-xs font-medium text-text-muted hover:text-text"
                  >
                    <span className="inline-block w-3">{zavreno ? "▸" : "▾"}</span>
                    Zakázky k akci ({g.deti.length})
                  </button>
                  {!zavreno && (
                    <div className="mt-1 space-y-2">
                      {g.deti.map((d) => (
                        <Karta key={d.id} z={d} lide={d.konstrukteri} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Akce vyřazené z konstrukce – jdou vrátit zpět. */}
      {vyrazene.length > 0 && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium text-text-muted">
            🚫 Konstrukce není třeba ({vyrazene.length})
          </summary>
          <div className="mt-2 space-y-2">
            {vyrazene.map((z) => (
              <div key={z.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
                <Link href={`/zakazky/${z.id}`} className="min-w-0 truncate hover:underline">
                  <span className="font-bold">{z.kod}</span>{" "}
                  <span className="text-text-muted">· {z.popis || z.mistoPlneni}</span>
                </Link>
                {smiVyradit && (
                  <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => vratit(z)}>
                    ↩ Vrátit do konstrukce
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
