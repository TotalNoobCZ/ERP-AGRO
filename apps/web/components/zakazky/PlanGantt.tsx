"use client";
// Interaktivní obal plánu: tažení pruhu akce = posun termínů (drag & place).
// Po puštění se otevře dialog s náhledem nových termínů a povinným důvodem.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Timeline, { type TRadek, type DragMode } from "./Timeline";
import { posunoutAkci } from "@/app/(erp)/zakazky/actions";
import { addDays, formatCz } from "@/lib/zakazky/dates";

type Pending = {
  zakazkaId: string;
  kod: string;
  mode: DragMode;
  deltaDays: number;
  zacatek: Date;
  konec: Date;
};

export default function PlanGantt({
  start,
  konec,
  radky,
  prazdno,
}: {
  start: Date;
  konec: Date;
  radky: TRadek[];
  prazdno?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [duvod, setDuvod] = useState("");
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  function najdiRadek(rs: TRadek[], id: string): TRadek | undefined {
    for (const r of rs) {
      if (r.id === id) return r;
      const f = r.podradky ? najdiRadek(r.podradky, id) : undefined;
      if (f) return f;
    }
    return undefined;
  }

  function onBarDrag(dragId: string, deltaDays: number, mode: DragMode) {
    const radek = najdiRadek(radky, dragId);
    const bar = radek?.bary[0];
    if (!radek || !bar) return;
    setPending({
      zakazkaId: dragId,
      kod: radek.label,
      mode,
      deltaDays,
      zacatek: bar.od,
      konec: bar.do,
    });
    setDuvod("");
    setChyba(null);
  }

  async function potvrdit() {
    if (!pending) return;
    setBusy(true);
    setChyba(null);
    const res = await posunoutAkci(pending.zakazkaId, pending.mode, pending.deltaDays, duvod);
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setPending(null);
    router.refresh();
  }

  const smer = (n: number) => (n > 0 ? `o ${n} dní později` : `o ${-n} dní dříve`);

  return (
    <>
      <Timeline start={start} konec={konec} radky={radky} prazdno={prazdno} onBarDrag={onBarDrag} />
      <p className="text-xs text-text-muted">
        Tip: pruh akce jde <strong>táhnout myší</strong> (posune celou akci) a za pravý okraj
        <strong> roztáhnout/zkrátit</strong> (změní konec). Změna vyžaduje důvod a zapíše se do historie.
      </p>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-base font-semibold">
              {pending.mode === "move" ? "Posunout akci" : "Změnit konec akce"}{" "}
              <span className="font-mono">{pending.kod}</span>
            </h2>

            <div className="mt-3 space-y-1 text-sm">
              {pending.mode === "move" ? (
                <>
                  <p>Celá akce se posune {smer(pending.deltaDays)}:</p>
                  <p className="text-text-muted">
                    {formatCz(pending.zacatek)} – {formatCz(pending.konec)} →{" "}
                    <strong className="text-text">
                      {formatCz(addDays(pending.zacatek, pending.deltaDays))} –{" "}
                      {formatCz(addDays(pending.konec, pending.deltaDays))}
                    </strong>
                  </p>
                  <p className="text-xs text-text-muted">
                    Posunou se i přiřazení pracovníků a milníky. Změna konce se zapíše do historie.
                  </p>
                </>
              ) : (
                <>
                  <p>Konec akce se změní {smer(pending.deltaDays)}:</p>
                  <p className="text-text-muted">
                    {formatCz(pending.konec)} →{" "}
                    <strong className="text-text">{formatCz(addDays(pending.konec, pending.deltaDays))}</strong>
                  </p>
                  <p className="text-xs text-text-muted">
                    Stejné chování jako „Změna termínu" na detailu (přepočítá přiřazení, zapíše historii).
                  </p>
                </>
              )}
            </div>

            <div className="mt-4">
              <label className="label">Důvod (povinný)</label>
              <input
                className="field"
                value={duvod}
                onChange={(e) => setDuvod(e.target.value)}
                placeholder="Proč se termín mění"
                autoFocus
              />
            </div>

            {chyba && <p className="err mt-2">{chyba}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPending(null)} disabled={busy}>
                Zrušit
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={potvrdit}
                disabled={busy || duvod.trim().length < 3}
              >
                {busy ? "Ukládám…" : "Potvrdit posun"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
