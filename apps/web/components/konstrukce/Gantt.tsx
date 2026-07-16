"use client";
// Gantt Konstrukce (ZADANI.md kap. 8): řádky = členové týmu, pod každým jeho
// úkoly (jeden úkol = jeden řádek, pořadí dle dlaždice). Žížala se táhne
// kalendářně mezi Začátkem a Koncem; jde posouvat a roztahovat (oba okraje).
// Absence se propisují jako obsazené dny na ose člena. Úkol bez termínů se
// nezobrazuje; splněný z Ganttu mizí. Kolize se po každé změně hlásí.
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { celkovaSirka, offsetPx, sirkaPx, mesicniZnacky, PX_ZA_DEN, okno } from "@/lib/zakazky/timeline";
import { parseDay, formatDay, formatCz, today, addDays } from "@/lib/zakazky/dates";
import { ABSENCE_LABELS, type AbsenceType } from "@erp/core";
import { userColor } from "@erp/ui";
import { posunoutUkol, type Kolize } from "@/app/(erp)/konstrukce/actions";
import { KolizeDialog } from "./dialogs";
import type { Absence, Clen, Ukol } from "./types";

const LANE_H = 26;
const LABEL_W = 200;

export const ABSENCE_BARVY: Record<string, string> = {
  dovolena: "#60a5fa",
  nemoc: "#f87171",
  lekar: "#fbbf24",
  muj_den: "#34d399",
};

type DragMode = "move" | "resize-l" | "resize-r";
type DragState = { taskId: string; mode: DragMode; startX: number; dx: number };

export default function Gantt({
  clenove,
  ukoly,
  absence,
  editable,
  onTaskClick,
  mesicu = 2,
}: {
  clenove: Clen[];
  ukoly: Ukol[];
  absence: Absence[];
  editable: boolean;
  onTaskClick?: (taskId: string) => void;
  mesicu?: number;
}) {
  const router = useRouter();
  const [ref, setRef] = useState(() => {
    const n = today();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  });
  const { start, konec } = useMemo(() => okno(ref, mesicu), [ref, mesicu]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const [pending, setPending] = useState<{ taskId: string; start: string; end: string; kolize: Kolize[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const sirka = celkovaSirka(start, konec);
  const znacky = mesicniZnacky(start, konec);
  const dnes = today();
  const dnesViditelny = dnes >= start && dnes <= konec;

  const dny = useMemo(() => {
    const out: { offset: number; cislo: number; weekend: boolean; mon: boolean }[] = [];
    for (let d = new Date(start); d <= konec; d = addDays(d, 1)) {
      const dow = d.getUTCDay();
      out.push({ offset: offsetPx(d, start), cislo: d.getUTCDate(), weekend: dow === 0 || dow === 6, mon: dow === 1 });
    }
    return out;
  }, [start, konec]);

  function posunRef(o: number) {
    setRef((r) => new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + o, 1)));
  }

  // ---- drag ----------------------------------------------------------------
  function startDrag(e: React.PointerEvent, taskId: string, mode: DragMode) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const st = { taskId, mode, startX: e.clientX, dx: 0 };
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
    async function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setTimeout(() => (movedRef.current = false), 0);
      if (!cur) return;
      const delta = Math.round(cur.dx / PX_ZA_DEN);
      if (delta === 0) return;
      const u = ukoly.find((x) => x.id === cur.taskId);
      if (!u || !u.startDate || !u.endDate) return;

      let ns = parseDay(u.startDate);
      let ne = parseDay(u.endDate);
      if (cur.mode === "move") { ns = addDays(ns, delta); ne = addDays(ne, delta); }
      else if (cur.mode === "resize-l") ns = addDays(ns, delta);
      else ne = addDays(ne, delta);
      if (ns > ne) return;

      await ulozit(cur.taskId, formatDay(ns), formatDay(ne), false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function ulozit(taskId: string, s: string, e2: string, vynutit: boolean) {
    setBusy(true);
    setChyba(null);
    const res = await posunoutUkol(taskId, s, e2, vynutit);
    setBusy(false);
    if (!res.ok) {
      if (res.kolize) {
        setPending({ taskId, start: s, end: e2, kolize: res.kolize });
        return;
      }
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setPending(null);
    router.refresh();
  }

  const snap = (dx: number) => Math.round(dx / PX_ZA_DEN) * PX_ZA_DEN;

  function Mrizka({ vyska }: { vyska: number }) {
    return (
      <>
        {dny.filter((x) => x.weekend).map((x, i) => (
          <div key={`w${i}`} className="absolute top-0 bg-overlay" style={{ left: x.offset, width: PX_ZA_DEN, height: vyska }} />
        ))}
        {dny.filter((x) => x.mon).map((x, i) => (
          <div key={`g${i}`} className="absolute top-0 border-l border-line" style={{ left: x.offset, height: vyska }} />
        ))}
        {dnesViditelny && (
          <div className="absolute top-0 border-l border-link/50" style={{ left: offsetPx(dnes, start), height: vyska }} />
        )}
      </>
    );
  }

  // Viditelné úkoly: s termíny, nesplněné, s řešitelem.
  const ukolyClena = (clenId: string) =>
    ukoly
      .filter((u) => u.assigneeId === clenId && u.startDate && u.endDate && !u.completed)
      .sort((a, b) => (a.orderInMember ?? 0) - (b.orderInMember ?? 0));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-text-muted">
          {editable
            ? "Žížaly jde táhnout (posun) a roztahovat za okraje (změna začátku/konce). Kolize se vždy nahlásí."
            : "Náhled – změny jen pro roli Zapisovat."}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => posunRef(-1)}>◀</button>
          <button className="btn-ghost" onClick={() => posunRef(1)}>▶</button>
        </div>
      </div>
      {chyba && <p className="err">{chyba}</p>}

      <div className="card overflow-x-auto">
        <div style={{ minWidth: LABEL_W + sirka }}>
          {/* hlavička dnů */}
          <div className="flex border-b border-line bg-muted">
            <div style={{ width: LABEL_W }} className="sticky left-0 z-20 shrink-0 bg-muted px-3 py-2 text-xs font-medium text-text-muted">
              Tým / úkoly
            </div>
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
              {dnesViditelny && <div className="absolute top-0 h-full border-l-2 border-link" style={{ left: offsetPx(dnes, start) }} />}
            </div>
          </div>

          {clenove.map((clen) => {
            const barva = userColor(clen.colorIndex);
            const absClena = absence.filter((a) => a.profileId === clen.id);
            const radky = ukolyClena(clen.id);

            return (
              <div key={clen.id}>
                {/* řádek člena s absencemi */}
                <div className="flex border-b border-line bg-muted/50">
                  <div style={{ width: LABEL_W }} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-surface px-3 py-1.5">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: barva }} />
                    <span className="text-sm font-semibold">{clen.name}</span>
                  </div>
                  <div className="relative" style={{ width: sirka, height: 24 }}>
                    <Mrizka vyska={24} />
                    {absClena.map((a) => (
                      <div
                        key={a.id}
                        className="absolute top-[4px] flex h-[16px] items-center overflow-hidden rounded px-1 text-[10px] font-medium text-black/80"
                        style={{
                          left: offsetPx(parseDay(a.startDate), start),
                          width: sirkaPx(parseDay(a.startDate), parseDay(a.endDate)),
                          backgroundColor: ABSENCE_BARVY[a.type] ?? "#94a3b8",
                        }}
                        title={`${ABSENCE_LABELS[a.type as AbsenceType] ?? a.type}: ${formatCz(parseDay(a.startDate))} – ${formatCz(parseDay(a.endDate))}`}
                      >
                        {ABSENCE_LABELS[a.type as AbsenceType] ?? a.type}
                      </div>
                    ))}
                  </div>
                </div>

                {/* řádky úkolů */}
                {radky.length === 0 && (
                  <div className="flex border-b border-line">
                    <div style={{ width: LABEL_W }} className="sticky left-0 z-10 shrink-0 bg-surface px-3 py-1.5 text-xs text-text-muted">
                      žádné naplánované úkoly
                    </div>
                    <div className="relative" style={{ width: sirka, height: LANE_H }}>
                      <Mrizka vyska={LANE_H} />
                    </div>
                  </div>
                )}
                {radky.map((u) => {
                  const od = parseDay(u.startDate!);
                  const doo = parseDay(u.endDate!);
                  const isDragged = drag?.taskId === u.id;
                  let left = offsetPx(od, start);
                  let width = sirkaPx(od, doo);
                  if (isDragged) {
                    const s = snap(drag!.dx);
                    if (drag!.mode === "move") left += s;
                    else if (drag!.mode === "resize-l") { left += s; width -= s; }
                    else width += s;
                  }
                  return (
                    <div key={u.id} className="flex border-b border-line">
                      <div style={{ width: LABEL_W }} className="sticky left-0 z-10 shrink-0 truncate bg-surface px-3 py-1.5 pl-8 text-xs text-text-muted">
                        {u.name}
                      </div>
                      <div className="relative" style={{ width: sirka, height: LANE_H }}>
                        <Mrizka vyska={LANE_H} />
                        <div
                          className={`absolute top-[3px] ${isDragged ? "z-20 opacity-80 ring-2 ring-link" : ""}`}
                          style={{ left, width: Math.max(PX_ZA_DEN, width) }}
                        >
                          <div
                            className={`relative flex h-[20px] items-center gap-1 overflow-hidden whitespace-nowrap rounded px-2 text-[11px] text-black/85 ${editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                            style={{ backgroundColor: barva }}
                            title={`${u.name} — ${u.projectName} (${formatCz(od)} – ${formatCz(doo)}${u.durationDays ? `, ${u.durationDays} prac. dní` : ""})`}
                            onPointerDown={editable ? (e) => startDrag(e, u.id, "move") : undefined}
                            onClick={() => {
                              if (!movedRef.current && onTaskClick) onTaskClick(u.id);
                            }}
                          >
                            {editable && (
                              <span
                                className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-black/20"
                                onPointerDown={(e) => startDrag(e, u.id, "resize-l")}
                                title="Táhnutím změníš začátek"
                              />
                            )}
                            <strong className="pl-1">{u.name}</strong>
                            <span className="opacity-70">· {u.projectName}</span>
                            {editable && (
                              <span
                                className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/20"
                                onPointerDown={(e) => startDrag(e, u.id, "resize-r")}
                                title="Táhnutím změníš konec"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {clenove.length === 0 && (
            <p className="px-3 py-6 text-sm text-text-muted">Žádní členové týmu (Správa → oddělení Konstrukce).</p>
          )}
        </div>
      </div>

      {/* legenda absencí */}
      <div className="flex flex-wrap gap-4 text-xs text-text-muted">
        {Object.entries(ABSENCE_BARVY).map(([typ, barva]) => (
          <span key={typ} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: barva }} />
            {ABSENCE_LABELS[typ as AbsenceType]}
          </span>
        ))}
      </div>

      {pending && (
        <KolizeDialog
          kolize={pending.kolize}
          busy={busy}
          onIgnorovat={() => ulozit(pending.taskId, pending.start, pending.end, true)}
          onZrusit={() => setPending(null)}
        />
      )}
    </div>
  );
}
