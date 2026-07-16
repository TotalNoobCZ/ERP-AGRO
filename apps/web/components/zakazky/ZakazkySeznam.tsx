"use client";
// Seznam akcí s rozbalovacími podzakázkami. Hlavní akce s podzakázkami má
// šipku; po rozbalení se pod ní odsazeně ukážou dceřiné zakázky.
import { useState } from "react";
import Link from "next/link";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { StavBadge } from "@/components/zakazky/common";
import type { ZakazkaListRow } from "@/lib/zakazky-query";

type Uzel = { row: ZakazkaListRow; deti: ZakazkaListRow[] };

function Obsah({ z }: { z: ZakazkaListRow }) {
  return (
    <>
      <span title="Priorita (1 = nejvyšší, 5 = nejnižší)" className="w-8 text-center text-xs font-semibold text-text-muted">
        P{z.priorita}
      </span>
      <span className="font-mono text-sm font-semibold">{z.kod}</span>
      <span className="flex-1 truncate text-sm text-text-muted">{z.popis || z.misto_plneni}</span>
      {z.inquiry_id && <span title="Vznikla z poptávky" className="hidden text-xs text-link sm:inline">z poptávky</span>}
      <span className="hidden text-xs text-text-muted sm:inline">{z.prirazeni?.[0]?.count ?? 0} os.</span>
      <span className="text-sm text-text-muted">{formatCz(parseDay(z.konec_aktualni))}</span>
      <StavBadge z={{ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }} />
    </>
  );
}

export function ZakazkySeznam({ uzly }: { uzly: Uzel[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="card divide-y divide-line">
      {uzly.map(({ row, deti }) => {
        const otevreno = open.has(row.id);
        return (
          <div key={row.id}>
            <div className="flex items-center hover:bg-accent">
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
              <Link href={`/zakazky/${row.id}`} className="flex flex-1 items-center gap-4 py-3 pr-4">
                <Obsah z={row} />
                {deti.length > 0 && (
                  <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] text-text-muted">
                    {deti.length} k akci
                  </span>
                )}
              </Link>
            </div>
            {otevreno &&
              deti.map((d) => (
                <Link
                  key={d.id}
                  href={`/zakazky/${d.id}`}
                  className="ml-7 flex items-center gap-4 border-l-2 border-link/40 py-2 pl-5 pr-4 hover:bg-accent"
                >
                  <Obsah z={d} />
                </Link>
              ))}
          </div>
        );
      })}
    </div>
  );
}
