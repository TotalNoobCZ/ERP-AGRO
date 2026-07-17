"use client";
// Seznam akcí. U hlavní akce se zobrazí VŠICHNI lidé (napříč jejími zakázkami),
// šipkou se rozbalí zakázky k akci a u každé jsou její lidé.
import Link from "next/link";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { usePersistentSet } from "@/lib/usePersistentSet";
import { StavBadge } from "@/components/zakazky/common";
import { userColor } from "@erp/ui";
import type { ZakazkaListRow } from "@/lib/zakazky-query";
import type { Osoba } from "@/lib/zakazky/lide";

type Dite = { row: ZakazkaListRow; lide: Osoba[] };
type Uzel = { row: ZakazkaListRow; deti: Dite[]; lideAkce: Osoba[] };

function Lide({ lide }: { lide: Osoba[] }) {
  if (lide.length === 0) return <span className="text-xs text-text-muted">bez lidí</span>;
  const max = 6;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {lide.slice(0, max).map((o) => (
        <span
          key={o.id}
          className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pl-1 pr-2 text-[11px]"
          title={o.name}
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: userColor(o.colorIndex) }} />
          {o.name}
        </span>
      ))}
      {lide.length > max && <span className="text-[11px] text-text-muted">+{lide.length - max}</span>}
    </span>
  );
}

function Zahlavi({ z }: { z: ZakazkaListRow }) {
  return (
    <>
      <span title="Priorita (1 = nejvyšší, 5 = nejnižší)" className="w-8 shrink-0 text-center text-xs font-semibold text-text-muted">
        P{z.priorita}
      </span>
      <span className="font-mono text-sm font-semibold">{z.kod}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{z.popis || z.misto_plneni}</span>
      <span className="hidden text-sm text-text-muted sm:inline">{formatCz(parseDay(z.konec_aktualni))}</span>
      <StavBadge z={{ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }} />
    </>
  );
}

export function ZakazkySeznam({ uzly }: { uzly: Uzel[] }) {
  const { has: jeOtevreno, toggle } = usePersistentSet("erp_zakazky_seznam_open");

  return (
    <div className="card divide-y divide-line">
      {uzly.map(({ row, deti, lideAkce }) => {
        const otevreno = jeOtevreno(row.id);
        return (
          <div key={row.id}>
            <div className="flex items-start hover:bg-accent">
              {deti.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggle(row.id)}
                  className="w-7 shrink-0 py-3 text-text-muted hover:text-text"
                  aria-label={otevreno ? "Sbalit zakázky k akci" : "Rozbalit zakázky k akci"}
                >
                  {otevreno ? "▾" : "▸"}
                </button>
              ) : (
                <span className="w-7 shrink-0" />
              )}
              <div className="flex-1 py-3 pr-4">
                <Link href={`/zakazky/${row.id}`} className="flex items-center gap-4">
                  <Zahlavi z={row} />
                  {deti.length > 0 && (
                    <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] text-text-muted">{deti.length} k akci</span>
                  )}
                </Link>
                <div className="mt-1.5 pl-8">
                  <Lide lide={lideAkce} />
                </div>
              </div>
            </div>

            {otevreno &&
              deti.map((d) => (
                <div key={d.row.id} className="ml-7 border-l-2 border-link/40 py-2 pl-5 pr-4 hover:bg-accent">
                  <Link href={`/zakazky/${d.row.id}`} className="flex items-center gap-4">
                    <Zahlavi z={d.row} />
                  </Link>
                  <div className="mt-1.5 pl-8">
                    <Lide lide={d.lide} />
                  </div>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
