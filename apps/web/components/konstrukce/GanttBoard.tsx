"use client";
// Obal Ganttu na samostatné kartě: filtr podle člena + hledání úkolu,
// klik na žížalu otevře dialog úkolu.
import { useMemo, useState } from "react";
import Gantt from "./Gantt";
import { TaskDialog } from "./dialogs";
import type { Absence, Clen, Ukol } from "./types";

export default function GanttBoard({
  clenove,
  ukoly,
  absence,
  editable,
}: {
  clenove: Clen[];
  ukoly: Ukol[];
  absence: Absence[];
  editable: boolean;
}) {
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [clenId, setClenId] = useState("");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtrovaniClenove = useMemo(
    () => (clenId ? clenove.filter((c) => c.id === clenId) : clenove),
    [clenove, clenId],
  );
  const filtrovaneUkoly = useMemo(
    () => (q ? ukoly.filter((u) => u.name.toLowerCase().includes(q) || u.projectName.toLowerCase().includes(q)) : ukoly),
    [ukoly, q],
  );

  const ukol = openTask ? ukoly.find((u) => u.id === openTask) : null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="field w-auto" value={clenId} onChange={(e) => setClenId(e.target.value)}>
          <option value="">Celý tým</option>
          {clenove.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="relative max-w-xs flex-1">
          <span className="absolute left-2.5 top-2 text-text-muted">🔍</span>
          <input
            className="field pl-8"
            placeholder="Hledat úkol / projekt…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {(clenId || q) && (
          <button className="btn-ghost" onClick={() => { setClenId(""); setQuery(""); }}>✕ Zrušit</button>
        )}
      </div>

      <Gantt
        clenove={filtrovaniClenove}
        ukoly={filtrovaneUkoly}
        absence={absence}
        editable={editable}
        onTaskClick={(id) => setOpenTask(id)}
        mesicu={3}
      />
      {ukol && <TaskDialog ukol={ukol} clenove={clenove} onClose={() => setOpenTask(null)} />}
    </>
  );
}
