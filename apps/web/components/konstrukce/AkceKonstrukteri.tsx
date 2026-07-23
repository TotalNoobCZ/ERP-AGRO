"use client";
// Přehled akcí s konstruktéry: karta akce (všichni konstruktéři napříč jejími
// zakázkami) + sbalitelný seznam zakázek k akci, u každé její konstruktéři.
import Link from "next/link";
import { userColor } from "@erp/ui";
import { formatDen } from "@/lib/format";
import { usePersistentSet } from "@/lib/usePersistentSet";
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
          style={{ backgroundColor: userColor(o.colorIndex), color: "#16181b" }}
        >
          {o.name}
        </span>
      ))}
    </span>
  );
}

function Karta({ z, lide }: { z: AkceZak; lide: Osoba[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <Link href={`/zakazky/${z.id}`} className="block hover:underline">
        <p className="font-bold">{z.kod}</p>
        <p className="text-xs text-text-muted">{z.popis || z.mistoPlneni}</p>
      </Link>
      <p className="mb-2 text-[11px] text-text-muted">
        {formatDen(z.zacatek)} – {formatDen(z.konecAktualni)}
      </p>
      <Chips lide={lide} />
    </div>
  );
}

export function AkceKonstrukteri({ skupiny }: { skupiny: AkceSkupina[] }) {
  const { has: jeSbaleno, toggle } = usePersistentSet("erp_konstrukce_prehled_sbaleno");

  if (skupiny.length === 0) {
    return <p className="text-sm text-text-muted">Žádné otevřené akce.</p>;
  }

  return (
    <div className="columns-1 gap-3 md:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
      {skupiny.map((g) => {
        const zavreno = jeSbaleno(g.akce.id);
        return (
          <div key={g.akce.id}>
            <Karta z={g.akce} lide={g.konstrukteriAkce} />
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
  );
}
