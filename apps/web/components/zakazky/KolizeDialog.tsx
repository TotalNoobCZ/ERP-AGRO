"use client";
// Sdílený kolizní dialog s náhradníky. Používá ho formulář nové akce i Tabule
// (přetažení pracovníka na akci). Postup řešení: stávající akce se člověku
// rozdělí kolem nového období a na překryv se dosadí náhradník.
import { useState } from "react";
import { vyresitKolizi, type KolizeInfo } from "@/app/(erp)/zakazky/actions";
import { type OsobaLite } from "./common";
import { formatDen } from "@/lib/format";

export function KolizeDialog({
  kolize,
  osoby,
  onClose,
  zavrenoText,
}: {
  kolize: KolizeInfo[];
  osoby: OsobaLite[];
  /** Zavření okna – parametr říká, zda jsou všechny kolize vyřešené. */
  onClose: (vseVyreseno: boolean) => void;
  /** Text v patičce, když je vše vyřešeno (default = pro formulář nové akce). */
  zavrenoText?: string;
}) {
  const [vyreseno, setVyreseno] = useState<Record<string, boolean>>({});
  const vseVyreseno = kolize.every((k) => vyreseno[k.prirazeniId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-h-[85vh] w-full max-w-lg overflow-auto p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-red-500">Kolize v přiřazení</h2>
          <button type="button" onClick={() => onClose(vseVyreseno)} className="text-text-muted hover:text-text" aria-label="Zavřít">✕</button>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Osoba už je v daném období přiřazená na jiné akci. Postup: stávající akce se člověku
          <strong> rozdělí kolem nového období</strong> (části před a po mu zůstanou) a na
          překryv se na stávající akci dosadí náhradník. Nemáte-li náhradníka, okno zavřete
          a upravte termíny nebo osobu.
        </p>

        <div className="mt-4 space-y-4">
          {kolize.map((k) => (
            <div key={k.prirazeniId} className="rounded-md border border-line p-3">
              <p className="text-sm">
                <strong>{k.osobaJmeno}</strong> už je v období {formatDen(k.od)} – {formatDen(k.do)} na akci{" "}
                <span className="font-mono">{k.zakazkaKod}</span>.
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Na akci <span className="font-mono">{k.zakazkaKod}</span>{" "}
                {k.predOd || k.poOd ? (
                  <>
                    osobě zůstane{" "}
                    {k.predOd && <strong>{formatDen(k.predOd)} – {formatDen(k.predDo)}</strong>}
                    {k.predOd && k.poOd ? " a " : ""}
                    {k.poOd && <strong>{formatDen(k.poOd)} – {formatDen(k.poDo)}</strong>}
                  </>
                ) : (
                  "osoba už nezůstane (nové období pokrývá celé)"
                )}
                ; na období {formatDen(k.nahradnikOd)} – {formatDen(k.nahradnikDo)} sem dosadíme náhradníka:
              </p>

              {vyreseno[k.prirazeniId] ? (
                <p className="mt-2 text-sm font-medium text-green-500">
                  ✓ Náhradník dosazen na akci {k.zakazkaKod}.
                </p>
              ) : (
                <ResitPolozka
                  kolize={k}
                  osoby={osoby.filter((o) => o.id !== k.osobaId && o.oddeleni !== "kancelar")}
                  onDone={() => setVyreseno((v) => ({ ...v, [k.prirazeniId]: true }))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-xs text-text-muted">
            {vseVyreseno
              ? zavrenoText ?? "Vše vyřešeno. Zavřete okno a klikněte znovu na „Vytvořit akci“."
              : "Vyřešte kolize, nebo okno zavřete a upravte zadání."}
          </span>
          <button type="button" onClick={() => onClose(vseVyreseno)} className={vseVyreseno ? "btn-primary" : "btn-ghost"}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}

function ResitPolozka({
  kolize,
  osoby,
  onDone,
}: {
  kolize: KolizeInfo;
  osoby: OsobaLite[];
  onDone: () => void;
}) {
  const [nahradnik, setNahradnik] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [nacita, setNacita] = useState(false);

  const obsazenost = new Map<string, { od: string; do: string }>();
  for (const o of kolize.obsazeni) if (!obsazenost.has(o.osobaId)) obsazenost.set(o.osobaId, { od: o.od, do: o.do });
  const volni = osoby.filter((o) => !obsazenost.has(o.id));
  const obsazeni = osoby.filter((o) => obsazenost.has(o.id));

  async function vyresit() {
    const b = obsazenost.get(nahradnik);
    let vynutit = false;
    if (b) {
      const os = osoby.find((o) => o.id === nahradnik);
      const jmeno = os?.name ?? "Tato osoba";
      if (!window.confirm(`${jmeno} je v období ${b.od} – ${b.do} obsazená u jiné akce. Dosadit i tak? Potvrzení se zapíše do historie.`)) return;
      vynutit = true;
    }
    setChyba(null);
    setNacita(true);
    const res = await vyresitKolizi(kolize.prirazeniId, kolize.novyOd, kolize.novyDo, nahradnik, vynutit);
    setNacita(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    onDone();
  }

  if (osoby.length === 0) {
    return (
      <p className="mt-2 text-sm text-amber-500">
        Není k dispozici žádná osoba (z Dílny/Elektra) jako náhradník. Zavřete okno a upravte
        termíny nebo přiřazenou osobu.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-2">
        <select className="field" value={nahradnik} onChange={(e) => setNahradnik(e.target.value)}>
          <option value="">— vyberte náhradníka —</option>
          {volni.length > 0 && (
            <optgroup label="Volní">
              {volni.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </optgroup>
          )}
          {obsazeni.length > 0 && (
            <optgroup label="Obsazení (nutné potvrzení)">
              {obsazeni.map((o) => {
                const b = obsazenost.get(o.id)!;
                return (
                  <option key={o.id} value={o.id}>
                    {o.name} — obsazen {b.od} – {b.do}
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>
        <button type="button" className="btn-primary whitespace-nowrap" disabled={nacita || !nahradnik} onClick={vyresit}>
          {nacita ? "…" : "Dosadit"}
        </button>
      </div>
      <p className="text-xs text-text-muted">
        Volní jsou nahoře. Obsazeného lze dosadit jen po potvrzení (zapíše se do historie).
      </p>
      {chyba && <p className="err">{chyba}</p>}
    </div>
  );
}
