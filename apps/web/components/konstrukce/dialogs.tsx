"use client";
// Dialogy modulu Konstrukce: úkol (termíny s dopočtem, poznámky, todos),
// projekt (Zodpovídá, Vyčistit, Archivovat) a kolizní hlášení (ZADANI.md kap. 9).
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recalcDates, KONSTRUKCE_LABELS } from "@erp/core";
import { userColor } from "@erp/ui";
import { formatDen, formatDateTime } from "@/lib/format";
import {
  upravitUkol,
  upravitProjekt,
  vycistitProjekt,
  archivovatProjekt,
  pridatPoznamkuK,
  pridatTodo,
  prepnoutTodo,
  smazatTodo,
  type Kolize,
} from "@/app/(erp)/konstrukce/actions";
import type { Clen, Projekt, Ukol, Poznamka, Todo } from "./types";

// ---------- Kolizní dialog (překryv se VŽDY hlásí, rozhoduje člověk) ----------
export function KolizeDialog({
  kolize,
  onIgnorovat,
  onZrusit,
  busy,
}: {
  kolize: Kolize[];
  onIgnorovat: () => void;
  onZrusit: () => void;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-red-500">Kolize na časové ose</h2>
        <p className="mt-1 text-sm text-text-muted">
          Naplánované období se překrývá s jiným úkolem nebo absencí. Překryv je povolený —
          můžeš ho vědomě přijmout, nebo uložení zrušit a termíny upravit (např. v Ganttu).
        </p>
        <div className="mt-3 overflow-hidden rounded-md border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left text-xs text-text-muted">
                <th className="px-3 py-1.5">Překrývá se s</th>
                <th className="px-3 py-1.5">V období</th>
              </tr>
            </thead>
            <tbody>
              {kolize.map((k, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5">{k.s}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{formatDen(k.od)} – {formatDen(k.do)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onZrusit} disabled={busy}>Zrušit</button>
          <button className="btn-primary" onClick={onIgnorovat} disabled={busy}>
            {busy ? "Ukládám…" : "Ignorovat a uložit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Poznámky (timeline) a todo list – sdílené pro úkol i projekt ----------
function PoznamkyBlok({
  cil,
  cilId,
  notes,
}: {
  cil: "task" | "project";
  cilId: string;
  notes: Poznamka[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    await pridatPoznamkuK(cil, cilId, text);
    setBusy(false);
    setText("");
    router.refresh();
  }

  return (
    <div>
      <p className="label">Poznámky</p>
      <div className="max-h-40 space-y-1.5 overflow-y-auto">
        {notes.length === 0 && <p className="text-xs text-text-muted">Zatím žádné poznámky.</p>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-md border border-line p-2 text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {n.author ?? "?"} · {formatDateTime(n.createdAt)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="field"
          placeholder="Napsat poznámku…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <button className="btn-ghost whitespace-nowrap" onClick={add} disabled={busy || !text.trim()}>Přidat</button>
      </div>
    </div>
  );
}

function TodoBlok({ cil, cilId, todos }: { cil: "task" | "project"; cilId: string; todos: Todo[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    await pridatTodo(cil, cilId, text);
    setBusy(false);
    setText("");
    router.refresh();
  }

  return (
    <div>
      <p className="label">Todo list</p>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {todos.length === 0 && <p className="text-xs text-text-muted">Žádné položky.</p>}
        {todos.map((t) => (
          <label key={t.id} className="group flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={t.done}
              onChange={async (e) => {
                await prepnoutTodo(cil, t.id, e.target.checked);
                router.refresh();
              }}
            />
            <span className={t.done ? "text-text-muted line-through" : ""}>{t.body}</span>
            <button
              type="button"
              className="invisible ml-auto text-xs text-red-500 hover:underline group-hover:visible"
              onClick={async () => {
                await smazatTodo(cil, t.id);
                router.refresh();
              }}
            >
              smazat
            </button>
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="field"
          placeholder="Nová položka…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <button className="btn-ghost whitespace-nowrap" onClick={add} disabled={busy || !text.trim()}>Přidat</button>
      </div>
    </div>
  );
}

// ---------- Dialog úkolu ----------
export function TaskDialog({
  ukol,
  clenove,
  onClose,
}: {
  ukol: Ukol;
  clenove: Clen[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(ukol.name);
  const [assignee, setAssignee] = useState(ukol.assigneeId ?? "");
  const [dates, setDates] = useState({
    startDate: ukol.startDate,
    endDate: ukol.endDate,
    durationDays: ukol.durationDays,
  });
  const [completed, setCompleted] = useState(ukol.completed);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [kolize, setKolize] = useState<Kolize[] | null>(null);

  function changeDate(field: "startDate" | "endDate" | "durationDays", value: string) {
    // Vyplněním dvou polí se dopočítá třetí (ZADANI.md kap. 9).
    const v = field === "durationDays" ? (value ? Number(value) : null) : value || null;
    setDates((d) => recalcDates(d, field, v));
  }

  async function save(vynutit = false) {
    setBusy(true);
    setChyba(null);
    const res = await upravitUkol(
      ukol.id,
      {
        name,
        assigneeId: assignee || null,
        startDate: dates.startDate,
        endDate: dates.endDate,
        durationDays: dates.durationDays,
        completed,
      },
      vynutit,
    );
    setBusy(false);
    if (!res.ok) {
      if (res.kolize) {
        setKolize(res.kolize);
        return;
      }
      setChyba(res.chyba ?? "Uložení se nezdařilo.");
      return;
    }
    setKolize(null);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          {/* zaškrtávací políčko „splněno" před názvem – jen v dialogu */}
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              title="Splněno"
            />
            <input
              className={`field text-base font-semibold ${completed ? "line-through" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="text-text-muted hover:text-text" onClick={onClose} aria-label="Zavřít">✕</button>
        </div>
        <p className="-mt-2 text-xs text-text-muted">{KONSTRUKCE_LABELS.project}: {ukol.projectName}</p>

        <div>
          <label className="label">{KONSTRUKCE_LABELS.assignee}</label>
          <select className="field" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">— nepřiřazeno —</option>
            {clenove.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Začátek / Konec / Trvání – vyplněním dvou se dopočítá třetí */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Začátek</label>
            <input type="date" className="field" value={dates.startDate ?? ""} onChange={(e) => changeDate("startDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Konec</label>
            <input type="date" className="field" value={dates.endDate ?? ""} onChange={(e) => changeDate("endDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Trvání (prac. dny)</label>
            <input type="number" min={1} className="field" value={dates.durationDays ?? ""} onChange={(e) => changeDate("durationDays", e.target.value)} />
          </div>
        </div>

        <PoznamkyBlok cil="task" cilId={ukol.id} notes={ukol.notes} />
        <TodoBlok cil="task" cilId={ukol.id} todos={ukol.todos} />

        {chyba && <p className="err">{chyba}</p>}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Zavřít bez uložení</button>
          <button className="btn-primary" onClick={() => save(false)} disabled={busy || !name.trim()}>
            {busy ? "Ukládám…" : "Uložit"}
          </button>
        </div>
      </div>

      {kolize && (
        <KolizeDialog
          kolize={kolize}
          busy={busy}
          onIgnorovat={() => save(true)}
          onZrusit={() => setKolize(null)}
        />
      )}
    </div>
  );
}

// ---------- Dialog projektu ----------
export function ProjectDialog({
  projekt,
  clenove,
  aktivniUkoly,
  onClose,
}: {
  projekt: Projekt;
  clenove: Clen[];
  aktivniUkoly: Ukol[]; // aktivní úkoly projektu (pro Vyčistit/Archivovat)
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(projekt.name);
  const [owner, setOwner] = useState(projekt.ownerId ?? "");
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const splnene = aktivniUkoly.filter((u) => u.completed).length;
  const nesplnene = aktivniUkoly.length - splnene;

  async function save() {
    setBusy(true);
    setChyba(null);
    const res = await upravitProjekt(projekt.id, { name, ownerId: owner || null });
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Uložení se nezdařilo.");
      return;
    }
    router.refresh();
    onClose();
  }

  async function vycistit() {
    setBusy(true);
    setChyba(null);
    const res = await vycistitProjekt(projekt.id);
    setBusy(false);
    if (!res.ok) { setChyba(res.chyba ?? "Nepovedlo se."); return; }
    router.refresh();
  }

  async function archivovat() {
    if (!window.confirm("Archivovat celý projekt (včetně jeho úkolů)?")) return;
    setBusy(true);
    setChyba(null);
    const res = await archivovatProjekt(projekt.id);
    setBusy(false);
    if (!res.ok) { setChyba(res.chyba ?? "Nepovedlo se."); return; }
    router.refresh();
    onClose();
  }

  const vlastnik = clenove.find((c) => c.id === owner);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <input className="field text-base font-semibold" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="text-text-muted hover:text-text" onClick={onClose} aria-label="Zavřít">✕</button>
        </div>
        <p className="-mt-2 text-xs text-text-muted">
          Zakázka:{" "}
          <Link href={`/zakazky/${projekt.zakazkaId}`} className="font-mono text-link hover:underline">
            {projekt.zakazkaKod}
          </Link>
        </p>

        <div>
          <label className="label">{KONSTRUKCE_LABELS.owner}</label>
          <div className="flex items-center gap-2">
            {vlastnik && (
              <span className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: userColor(vlastnik.colorIndex) }} />
            )}
            <select className="field" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">— nikdo —</option>
              {clenove.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <PoznamkyBlok cil="project" cilId={projekt.id} notes={projekt.notes} />
        <TodoBlok cil="project" cilId={projekt.id} todos={projekt.todos} />

        {chyba && <p className="err">{chyba}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              onClick={vycistit}
              disabled={busy || splnene === 0}
              title="Přesune splněné úkoly projektu do Archivu"
            >
              {KONSTRUKCE_LABELS.clean} ({splnene})
            </button>
            <button
              className="btn-danger"
              onClick={archivovat}
              disabled={busy || nesplnene > 0}
              title={nesplnene > 0 ? `Nelze – ${nesplnene} nesplněných úkolů` : "Archivovat celý projekt"}
            >
              {KONSTRUKCE_LABELS.archive}
            </button>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose} disabled={busy}>Zavřít</button>
            <button className="btn-primary" onClick={save} disabled={busy || !name.trim()}>
              {busy ? "Ukládám…" : "Uložit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
