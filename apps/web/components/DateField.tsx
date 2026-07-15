"use client";
// ----------------------------------------------------------------------------
//  České datumové pole. Nahrazuje nativní <input type="date">, který se řídí
//  jazykem prohlížeče (často US MM/DD/RRRR). Zobrazuje/píše se DD.MM.RRRR,
//  ven dává ISO "YYYY-MM-DD". Volitelný kalendář (vlastní, bez knihoven).
//  name → skrytý input, aby fungovalo odesílání přes FormData.
// ----------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";

const MESICE = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const DNY = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function isoToCz(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`;
}

/** "d.m.rrrr" / "d. m. rrrr" → ISO, nebo "" když nevalidní. */
function czToIso(text: string): string {
  const m = /^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*$/.exec(text);
  if (!m) return "";
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return ""; // neexistující datum
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function DateField({
  value,
  onChange,
  name,
  id,
  required,
  className = "",
  placeholder = "dd.mm.rrrr",
}: {
  value: string; // ISO "YYYY-MM-DD" nebo ""
  onChange: (iso: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(isoToCz(value));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sync z vnějšího value (např. dopočet termínů).
  useEffect(() => {
    setText(isoToCz(value));
  }, [value]);

  // Zavření kalendáře klikem mimo.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function commit(t: string) {
    setText(t);
    const iso = czToIso(t);
    if (iso) onChange(iso);
    else if (t.trim() === "") onChange("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className={`field ${className}`}
          placeholder={placeholder}
          value={text}
          required={required}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setText(isoToCz(value))}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-1 shrink-0 rounded-md border border-input px-2 text-sm hover:bg-accent"
          title="Otevřít kalendář"
          tabIndex={-1}
        >
          📅
        </button>
      </div>
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <Calendar
          value={value}
          onPick={(iso) => {
            onChange(iso);
            setText(isoToCz(iso));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Calendar({ value, onPick }: { value: string; onPick: (iso: string) => void }) {
  const base = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date();
  const [ym, setYm] = useState({ y: base.getUTCFullYear(), m: base.getUTCMonth() });

  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const startDow = (first.getUTCDay() + 6) % 7; // Po=0
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function shift(delta: number) {
    const d = new Date(Date.UTC(ym.y, ym.m + delta, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }

  return (
    <div className="absolute z-50 mt-1 w-64 rounded-md border border-line bg-surface p-2 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <button type="button" className="rounded px-2 hover:bg-accent" onClick={() => shift(-1)}>◀</button>
        <span className="text-sm font-medium">{MESICE[ym.m]} {ym.y}</span>
        <button type="button" className="rounded px-2 hover:bg-accent" onClick={() => shift(1)}>▶</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-text-muted">
        {DNY.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const sel = iso === value;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(iso)}
              className={`rounded py-1 text-sm hover:bg-accent ${sel ? "bg-user-0 font-semibold text-on-accent" : ""}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
