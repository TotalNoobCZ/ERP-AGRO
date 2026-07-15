"use client";
// Obal Ganttu na samostatné kartě: klik na žížalu otevře dialog úkolu.
import { useState } from "react";
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
  const ukol = openTask ? ukoly.find((u) => u.id === openTask) : null;

  return (
    <>
      <Gantt
        clenove={clenove}
        ukoly={ukoly}
        absence={absence}
        editable={editable}
        onTaskClick={(id) => setOpenTask(id)}
        mesicu={3}
      />
      {ukol && <TaskDialog ukol={ukol} clenove={clenove} onClose={() => setOpenTask(null)} />}
    </>
  );
}
