"use client";
// Časová osa (plán) – port z Planovani/src/components/Timeline.tsx,
// barvy dle tématu, logika 1:1. Navíc: volitelné tažení pruhů
// (posun celé akce / roztažení konce) přes pointer events.
import { useRef, useState } from "react";
import { usePersistentSet } from "@/lib/usePersistentSet";
import Link from "next/link";
import { celkovaSirka, offsetPx, sirkaPx, mesicniZnacky, PX_ZA_DEN } from "@/lib/zakazky/timeline";
import { today, formatCz, addDays } from "@/lib/zakazky/dates";

export type TBar = {
  od: Date; do: Date; lane: number; barva: string;
  label?: string; href?: string; titulek?: string;
  /** id pro drag & drop; bez něj je pruh statický */
  dragId?: string;
  /** povolit roztažení konce (pravý úchyt) */
  resizable?: boolean;
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

export type DragMode = "move" | "resize";

const LANE_H = 26;
const LABEL_W = 200;

type DragState = {
  dragId: string;
  mode: DragMode;
  startX: number;
  dx: number; // nesnapnutý posun v px
};

export default function Timeline({
  start, konec, radky, prazdno = "Žádná data v tomto období.",
  onBarDrag, persistKey = "erp_zakazky_plan_otevrene",
}: {
  start: Date; konec: Date; radky: TRadek[]; prazdno?: string;
  /** volá se po puštění taženého pruhu s posunem ve dnech (≠ 0) */
  onBarDrag?: (dragId: string, deltaDays: number, mode: DragMode) => void;
  /** localStorage klíč pro zapamatování rozbalených podřádků (per pohled) */
  persistKey?: string;
}) {
  const { has: jeOtevreno, toggle, replace } = usePersistentSet(persistKey);

  // Řádky s podřádky (jde je rozbalit) – pro „zobrazit vše" / „skrýt vše".
  const rozbalitelne: string[] = [];
  (function sber(rs: TRadek[]) {
    for (const r of rs) {
      if (r.podradky?.length) {
        rozbalitelne.push(r.id);
        sber(r.podradky);
      }
    }
  })(radky);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);

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

  // ---- tažení pruhů ------------------------------------------------------
  function startDrag(e: React.PointerEvent, dragId: string, mode: DragMode) {
    if (!onBarDrag) return;
    e.preventDefault();
    e.stopPropagation();
    const st = { dragId, mode, startX: e.clientX, dx: 0 };
    dragRef.current = st;
    movedRef.current = false;
    setDrag(st);

    function onMove(ev: PointerEvent) {
      const cur = dragRef.current;
      if (!cur) return;
      const dx = ev.clientX - cur.startX;
      if (Math.abs(dx) > 3) movedRef.current = true;
      const next = { ...cur, dx };
      dragRef.current = next;
      setDrag(next);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!cur) return;
      const deltaDays = Math.round(cur.dx / PX_ZA_DEN);
      if (deltaDays !== 0) onBarDrag!(cur.dragId, deltaDays, cur.mode);
      // klik po tažení potlačí onClickCapture níže; příznak shodíme vzápětí
      setTimeout(() => {
        movedRef.current = false;
      }, 0);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function snapPx(dx: number): number {
    return Math.round(dx / PX_ZA_DEN) * PX_ZA_DEN;
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

  function radekEl(r: TRadek, hloubka: number) {
    const vyska = r.pocetRad * LANE_H + 8;
    const maPodradky = !!r.podradky?.length;
    const otevreno = jeOtevreno(r.id);
    return (
      <div key={`${r.id}@${hloubka}`} className="flex border-b border-line">
        <div style={{ width: LABEL_W, paddingLeft: 12 + hloubka * 16 }} className="sticky left-0 z-10 shrink-0 bg-surface py-2 pr-3">
          <div className="flex items-center gap-1">
            {maPodradky ? (
              <button type="button" onClick={() => toggle(r.id)} className="w-4 shrink-0 text-text-muted hover:text-text" aria-label="Rozbalit">
                {otevreno ? "▾" : "▸"}
              </button>
            ) : (
              hloubka > 0 && <span className="w-4 shrink-0" />
            )}
            {r.href ? (
              <Link href={r.href} className="text-sm font-medium text-link hover:underline">{r.label}</Link>
            ) : (
              <span className={`text-sm ${hloubka > 0 ? "text-text-muted" : "font-medium"}`}>{r.label}</span>
            )}
          </div>
          {r.sublabel && <div className="truncate text-xs text-text-muted">{r.sublabel}</div>}
          {r.datum && <div className="text-xs text-text-muted">{r.datum}</div>}
        </div>
        <div className="relative" style={{ width: sirka, height: vyska }}>
          <Mrizka />
          {r.bary.map((b, i) => {
            const minTextW = (b.label?.length ?? 0) * 7 + 16;
            const draggable = Boolean(b.dragId && onBarDrag);
            const isDragged = Boolean(drag && b.dragId && b.dragId === drag.dragId);
            const posunPx = isDragged && drag!.mode === "move" ? snapPx(drag!.dx) : 0;
            const extraSirka = isDragged && drag!.mode === "resize" ? snapPx(drag!.dx) : 0;

            const bar = (
              <div
                className={`relative mx-px flex h-[20px] items-center overflow-hidden whitespace-nowrap rounded border border-white/25 px-2 text-[11px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_0_1px_rgba(0,0,0,0.25)] ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragged ? "opacity-80 ring-2 ring-link" : ""}`}
                style={{ backgroundColor: b.barva }}
                title={b.titulek}
                onPointerDown={draggable ? (e) => startDrag(e, b.dragId!, "move") : undefined}
              >
                {b.label}
                {draggable && b.resizable && (
                  <span
                    className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/25"
                    title="Táhnutím změníš konec"
                    onPointerDown={(e) => startDrag(e, b.dragId!, "resize")}
                  />
                )}
              </div>
            );
            return (
              <div
                key={i}
                className="absolute"
                style={{
                  left: offsetPx(b.od, start) + posunPx,
                  width: Math.max(PX_ZA_DEN, sirkaPx(b.od, b.do) + extraSirka),
                  minWidth: isDragged ? undefined : minTextW,
                  top: b.lane * LANE_H + 4,
                  zIndex: isDragged ? 20 : undefined,
                }}
              >
                {b.href ? (
                  <Link
                    href={b.href}
                    draggable={false}
                    onClick={(e) => {
                      if (movedRef.current || drag) e.preventDefault();
                    }}
                  >
                    {bar}
                  </Link>
                ) : (
                  bar
                )}
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

  function RadekStrom({ r, hloubka }: { r: TRadek; hloubka: number }) {
    return (
      <div>
        {radekEl(r, hloubka)}
        {jeOtevreno(r.id) && r.podradky?.map((pr) => <RadekStrom key={`${pr.id}@${hloubka + 1}`} r={pr} hloubka={hloubka + 1} />)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rozbalitelne.length > 0 && (
        <div className="flex gap-2">
          <button type="button" className="btn-ghost text-xs" onClick={() => replace(rozbalitelne)}>
            ▾ Zobrazit vše
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={() => replace([])}>
            ▸ Skrýt vše
          </button>
        </div>
      )}
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

        {/* Řady (rekurzivně – akce → zakázky k akci → pracovníci) */}
        {radky.length === 0 ? (
          <p className="px-3 py-6 text-sm text-text-muted">{prazdno}</p>
        ) : (
          radky.map((r) => <RadekStrom key={r.id} r={r} hloubka={0} />)
        )}
        </div>
      </div>
    </div>
  );
}
