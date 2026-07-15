"use client";
// Časová osa (plán) – port z Planovani/src/components/Timeline.tsx,
// barvy přizpůsobené tmavému tématu, logika 1:1.
import { useState } from "react";
import Link from "next/link";
import { celkovaSirka, offsetPx, sirkaPx, mesicniZnacky, PX_ZA_DEN } from "@/lib/zakazky/timeline";
import { today, formatCz, addDays } from "@/lib/zakazky/dates";

export type TBar = {
  od: Date; do: Date; lane: number; barva: string;
  label?: string; href?: string; titulek?: string;
};
export type TZnacka = { datum: Date; barva: string; titulek: string };
export type TRadek = {
  id: string;
  label: string;
  sublabel?: string;
  datum?: string;
  href?: string;
  pocetRad: number;
  bary: TBar[];
  znacky: TZnacka[];
  podradky?: TRadek[]; // rozbalitelné podřádky (např. pracovníci akce)
};

const LANE_H = 26;
const LABEL_W = 200;

export default function Timeline({
  start, konec, radky, prazdno = "Žádná data v tomto období.",
}: {
  start: Date; konec: Date; radky: TRadek[]; prazdno?: string;
}) {
  const [otevrene, setOtevrene] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOtevrene((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const sirka = celkovaSirka(start, konec);
  const znacky = mesicniZnacky(start, konec);
  const dnes = today();
  const dnesViditelny = dnes >= start && dnes <= konec;
  const dnesOff = offsetPx(dnes, start);

  const dny: { offset: number; cislo: number; weekend: boolean; mon: boolean }[] = [];
  for (let d = new Date(start); d <= konec; d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    dny.push({ offset: offsetPx(d, start), cislo: d.getUTCDate(), weekend: dow === 0 || dow === 6, mon: dow === 1 });
  }

  function Mrizka() {
    return (
      <>
        {dny.filter((x) => x.weekend).map((x, i) => (
          <div key={`w${i}`} className="absolute top-0 h-full bg-overlay" style={{ left: x.offset, width: PX_ZA_DEN }} />
        ))}
        {dny.filter((x) => x.mon).map((x, i) => (
          <div key={`g${i}`} className="absolute top-0 h-full border-l border-line" style={{ left: x.offset }} />
        ))}
        {dnesViditelny && <div className="absolute top-0 h-full border-l border-link/40" style={{ left: dnesOff }} />}
      </>
    );
  }

  function radekEl(r: TRadek, podradek: boolean) {
    const vyska = r.pocetRad * LANE_H + 8;
    const maPodradky = !!r.podradky?.length;
    const otevreno = otevrene.has(r.id);
    return (
      <div key={r.id + (podradek ? "-p" : "")} className="flex border-b border-line">
        <div style={{ width: LABEL_W }} className={`sticky left-0 z-10 shrink-0 bg-surface px-3 py-2 ${podradek ? "pl-7" : ""}`}>
          <div className="flex items-center gap-1">
            {maPodradky && (
              <button type="button" onClick={() => toggle(r.id)} className="w-4 shrink-0 text-text-muted hover:text-text" aria-label="Rozbalit pracovníky">
                {otevreno ? "▾" : "▸"}
              </button>
            )}
            {r.href ? (
              <Link href={r.href} className="text-sm font-medium text-link hover:underline">{r.label}</Link>
            ) : (
              <span className={`text-sm ${podradek ? "text-text-muted" : "font-medium"}`}>{r.label}</span>
            )}
          </div>
          {r.sublabel && <div className="truncate text-xs text-text-muted">{r.sublabel}</div>}
          {r.datum && <div className="text-xs text-text-muted">{r.datum}</div>}
        </div>
        <div className="relative" style={{ width: sirka, height: vyska }}>
          <Mrizka />
          {r.bary.map((b, i) => {
            const minTextW = (b.label?.length ?? 0) * 7 + 16;
            const bar = (
              <div
                className="flex h-[20px] items-center overflow-hidden whitespace-nowrap rounded px-2 text-[11px] font-medium text-white"
                style={{ backgroundColor: b.barva }}
                title={b.titulek}
              >
                {b.label}
              </div>
            );
            return (
              <div key={i} className="absolute" style={{ left: offsetPx(b.od, start), width: sirkaPx(b.od, b.do), minWidth: minTextW, top: b.lane * LANE_H + 4 }}>
                {b.href ? <Link href={b.href}>{bar}</Link> : bar}
              </div>
            );
          })}
          {r.znacky.map((z, i) => (
            <div key={`m${i}`} className="absolute" title={`${z.titulek} — ${formatCz(z.datum)}`} style={{ left: offsetPx(z.datum, start) - 5, top: 5 }}>
              <div className="h-[11px] w-[11px] rotate-45 border border-surface" style={{ backgroundColor: z.barva }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <div style={{ minWidth: LABEL_W + sirka }}>
        {/* Hlavička */}
        <div className="flex border-b border-line bg-muted">
          <div style={{ width: LABEL_W }} className="sticky left-0 z-20 shrink-0 bg-muted px-3 py-2 text-xs font-medium text-text-muted">Období</div>
          <div className="relative" style={{ width: sirka, height: 46 }}>
            {dny.filter((x) => x.weekend).map((x, i) => (
              <div key={`hw${i}`} className="absolute top-0 h-full bg-overlay" style={{ left: x.offset, width: PX_ZA_DEN }} />
            ))}
            {znacky.map((z, i) => (
              <div key={i} className="absolute top-0 border-l border-line pl-1 pt-1 text-xs font-medium text-text-muted" style={{ left: z.offset }}>{z.label}</div>
            ))}
            {dny.map((x, i) => (
              <div key={`d${i}`} className={`absolute text-center text-[10px] ${x.weekend ? "text-text-muted/50" : "text-text-muted"}`} style={{ left: x.offset, width: PX_ZA_DEN, top: 26 }}>{x.cislo}</div>
            ))}
            {dnesViditelny && <div className="absolute top-0 h-full border-l-2 border-link" style={{ left: dnesOff }} />}
          </div>
        </div>

        {/* Řady */}
        {radky.length === 0 ? (
          <p className="px-3 py-6 text-sm text-text-muted">{prazdno}</p>
        ) : (
          radky.map((r) => (
            <div key={r.id}>
              {radekEl(r, false)}
              {otevrene.has(r.id) && r.podradky?.map((pr) => radekEl(pr, true))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
