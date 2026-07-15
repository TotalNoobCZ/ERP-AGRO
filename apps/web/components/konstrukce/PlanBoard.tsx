"use client";
// Karta Plánování (ZADANI.md kap. 7): vlevo 1/3 dlaždice členů, vpravo 2/3
// masonry projektů. Drag & drop úkolů (dnd-kit): z projektu na člena, mezi
// členy, zpět doprava (odebrání), řazení uvnitř dlaždice člena.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KONSTRUKCE_LABELS } from "@erp/core";
import { COLOR_TOKENS, userColor } from "@erp/ui";
import { formatDen } from "@/lib/format";
import {
  upravitUkol,
  vytvoritUkol,
  vytvoritProjekt,
  seraditUkoly,
  type Kolize,
} from "@/app/(erp)/konstrukce/actions";
import { KolizeDialog, TaskDialog, ProjectDialog } from "./dialogs";
import { MemberDialog } from "./MemberDialog";
import type { Absence, Clen, Projekt, Ukol } from "./types";

type ZakazkaLite = { id: string; kod: string; mistoPlneni: string };

export default function PlanBoard({
  clenove,
  projekty,
  ukoly,
  absence,
  zakazky,
  editable,
}: {
  clenove: Clen[];
  projekty: Projekt[];
  ukoly: Ukol[];
  absence: Absence[];
  zakazky: ZakazkaLite[];
  editable: boolean;
}) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [dragged, setDragged] = useState<Ukol | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [openProject, setOpenProject] = useState<string | null>(null);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [pending, setPending] = useState<{ taskId: string; assigneeId: string; kolize: Kolize[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const taskMatches = (u: Ukol) =>
    !q || u.name.toLowerCase().includes(q) || u.projectName.toLowerCase().includes(q);

  // Nový projekt
  const [showNewProject, setShowNewProject] = useState(false);
  const [npName, setNpName] = useState("");
  const [npZakazka, setNpZakazka] = useState("");

  // ESC zavírá dialogy
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenTask(null);
        setOpenProject(null);
        setOpenMember(null);
        setShowNewProject(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ukolyClena = useMemo(() => {
    const map = new Map<string, Ukol[]>();
    for (const c of clenove) map.set(c.id, []);
    for (const u of ukoly) {
      if (u.assigneeId && !u.completed && map.has(u.assigneeId)) map.get(u.assigneeId)!.push(u);
    }
    for (const list of map.values()) list.sort((a, b) => (a.orderInMember ?? 0) - (b.orderInMember ?? 0));
    return map;
  }, [clenove, ukoly]);

  const ukolyProjektu = useMemo(() => {
    const map = new Map<string, Ukol[]>();
    for (const p of projekty) map.set(p.id, []);
    for (const u of ukoly) {
      // Úkoly uvnitř projektu se řadí automaticky abecedně (kap. 7).
      if (map.has(u.projectId)) map.get(u.projectId)!.push(u);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, "cs"));
    return map;
  }, [projekty, ukoly]);

  async function priradit(taskId: string, assigneeId: string | null, vynutit = false) {
    setBusy(true);
    setChyba(null);
    const res = await upravitUkol(taskId, { assigneeId }, vynutit);
    setBusy(false);
    if (!res.ok) {
      if (res.kolize && assigneeId) {
        setPending({ taskId, assigneeId, kolize: res.kolize });
        return;
      }
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setPending(null);
    router.refresh();
  }

  async function onDragEnd(e: DragEndEvent) {
    const task = dragged;
    setDragged(null);
    if (!task || !e.over) return;
    const overId = String(e.over.id);

    if (overId.startsWith("member:")) {
      const memberId = overId.slice(7);
      if (task.assigneeId === memberId) return;
      // Přetažení jinému členovi → kontrola kolize u NOVÉHO řešitele (kap. 7).
      await priradit(task.id, memberId);
    } else if (overId === "unassign") {
      if (task.assigneeId) await priradit(task.id, null);
    } else if (overId.startsWith("before:") || overId.startsWith("end:")) {
      // řazení uvnitř dlaždice člena
      const [kind, rest] = overId.split(":", 2) as [string, string];
      const targetTaskId = kind === "before" ? rest : null;
      const memberId = kind === "end" ? rest : ukoly.find((u) => u.id === targetTaskId)?.assigneeId ?? null;
      if (!memberId) return;

      if (task.assigneeId !== memberId) {
        await priradit(task.id, memberId);
        return;
      }
      const list = (ukolyClena.get(memberId) ?? []).filter((u) => u.id !== task.id);
      const ids = list.map((u) => u.id);
      if (targetTaskId) {
        const idx = ids.indexOf(targetTaskId);
        ids.splice(idx === -1 ? ids.length : idx, 0, task.id);
      } else {
        ids.push(task.id);
      }
      await seraditUkoly(ids);
      router.refresh();
    }
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id).replace(/^task:/, "");
    setDragged(ukoly.find((u) => u.id === id) ?? null);
  }

  async function zalozitProjekt() {
    if (!npName.trim() || !npZakazka) return;
    setBusy(true);
    const res = await vytvoritProjekt(npZakazka, npName);
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setNpName("");
    setNpZakazka("");
    setShowNewProject(false);
    router.refresh();
  }

  const openTaskData = openTask ? ukoly.find((u) => u.id === openTask) : null;
  const openProjectData = openProject ? projekty.find((p) => p.id === openProject) : null;
  const openMemberData = openMember ? clenove.find((c) => c.id === openMember) : null;

  const visibleProjekty = q
    ? projekty.filter(
        (p) => p.name.toLowerCase().includes(q) || (ukolyProjektu.get(p.id) ?? []).some(taskMatches),
      )
    : projekty;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {chyba && <p className="err mb-2">{chyba}</p>}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <span className="absolute left-2.5 top-2 text-text-muted">🔍</span>
          <input
            className="field pl-8"
            placeholder="Hledat úkol / projekt…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {q && <button className="btn-ghost" onClick={() => setQuery("")}>✕ Zrušit</button>}
      </div>
      <div className="flex gap-4">
        {/* Levá 1/3 – dlaždice členů */}
        <div className="w-1/3 min-w-[260px] space-y-3">
          {clenove.map((c) => (
            <MemberTile
              key={c.id}
              clen={c}
              ukoly={(ukolyClena.get(c.id) ?? []).filter(taskMatches)}
              editable={editable}
              onOpen={() => setOpenMember(c.id)}
              onTaskClick={(id) => setOpenTask(id)}
            />
          ))}
          {clenove.length === 0 && (
            <p className="text-sm text-text-muted">
              Žádné dlaždice. Ve Správě dej členům týmu oddělení „Konstrukce“ a zaškrtni „lze přiřazovat“.
            </p>
          )}
        </div>

        {/* Pravá 2/3 – masonry projektů (zároveň drop zóna pro odebrání) */}
        <UnassignZone>
          <div className="mb-3 flex items-center justify-end">
            {editable && (
              <button className="btn-primary" onClick={() => setShowNewProject(true)}>
                {KONSTRUKCE_LABELS.addProject}
              </button>
            )}
          </div>
          <div className="columns-1 gap-3 md:columns-2 2xl:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
            {visibleProjekty.map((p) => (
              <ProjectTile
                key={p.id}
                projekt={p}
                ukoly={(ukolyProjektu.get(p.id) ?? []).filter(taskMatches)}
                clenove={clenove}
                editable={editable}
                onOpen={() => setOpenProject(p.id)}
                onTaskClick={(id) => setOpenTask(id)}
              />
            ))}
          </div>
          {q && visibleProjekty.length === 0 && (
            <p className="text-sm text-text-muted">Nic neodpovídá hledání.</p>
          )}
          {projekty.length === 0 && (
            <p className="text-sm text-text-muted">
              Žádné projekty. Projekt založíš tlačítkem výše (musí patřit k zakázce) nebo z detailu zakázky.
            </p>
          )}
        </UnassignZone>
      </div>

      {/* Ghost při tažení */}
      <DragOverlay>
        {dragged && (
          <div className="w-52 rounded-md border border-line bg-surface p-2 text-sm shadow-lg">
            <p className="font-medium">{dragged.name}</p>
            <p className="text-xs text-text-muted">{dragged.projectName}</p>
          </div>
        )}
      </DragOverlay>

      {/* Dialogy */}
      {openTaskData && (
        <TaskDialog ukol={openTaskData} clenove={clenove} onClose={() => setOpenTask(null)} />
      )}
      {openProjectData && (
        <ProjectDialog
          projekt={openProjectData}
          clenove={clenove}
          aktivniUkoly={ukolyProjektu.get(openProjectData.id) ?? []}
          onClose={() => setOpenProject(null)}
        />
      )}
      {openMemberData && (
        <MemberDialog
          clen={openMemberData}
          ukoly={ukoly.filter((u) => u.assigneeId === openMemberData.id)}
          absence={absence.filter((a) => a.profileId === openMemberData.id)}
          editable={editable}
          onClose={() => setOpenMember(null)}
          onTaskClick={(id) => {
            setOpenMember(null);
            setOpenTask(id);
          }}
        />
      )}
      {pending && (
        <KolizeDialog
          kolize={pending.kolize}
          busy={busy}
          onIgnorovat={() => priradit(pending.taskId, pending.assigneeId, true)}
          onZrusit={() => setPending(null)}
        />
      )}

      {/* Nový projekt */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3 p-6">
            <h2 className="text-base font-semibold">{KONSTRUKCE_LABELS.addProject}</h2>
            <div>
              <label className="label">Název projektu</label>
              <input
                className="field"
                value={npName}
                autoFocus
                onChange={(e) => setNpName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") zalozitProjekt(); }}
              />
            </div>
            <div>
              <label className="label">Výrobní zakázka (povinné – projekt vždy patří k zakázce)</label>
              <select className="field" value={npZakazka} onChange={(e) => setNpZakazka(e.target.value)}>
                <option value="">— vyberte zakázku —</option>
                {zakazky.map((z) => (
                  <option key={z.id} value={z.id}>{z.kod} — {z.mistoPlneni}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setShowNewProject(false)}>Zrušit</button>
              <button className="btn-primary" onClick={zalozitProjekt} disabled={busy || !npName.trim() || !npZakazka}>
                {busy ? "Zakládám…" : "Založit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

// ---------- dílčí komponenty ----------

function DraggableTask({
  ukol,
  barva,
  showProject,
  editable,
  onClick,
}: {
  ukol: Ukol;
  barva: string;
  showProject: boolean;
  editable: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${ukol.id}`,
    disabled: !editable || ukol.completed,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`cursor-pointer rounded-md p-2 text-sm shadow-sm transition ${isDragging ? "opacity-40" : ""} ${editable && !ukol.completed ? "hover:brightness-110" : ""}`}
      style={{ backgroundColor: ukol.completed ? COLOR_TOKENS.neutral : barva, color: "#16181b" }}
      title={ukol.name}
    >
      <p className={`truncate font-semibold ${ukol.completed ? "line-through opacity-70" : ""}`}>{ukol.name}</p>
      {showProject && <p className="truncate text-xs opacity-75">{ukol.projectName}</p>}
      {ukol.startDate && ukol.endDate && !ukol.completed && (
        <p className="text-[10px] opacity-70">{formatDen(ukol.startDate)} – {formatDen(ukol.endDate)}</p>
      )}
    </div>
  );
}

function DropSlot({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`h-1.5 rounded ${isOver ? "bg-link" : ""}`} />;
}

function MemberTile({
  clen,
  ukoly,
  editable,
  onOpen,
  onTaskClick,
}: {
  clen: Clen;
  ukoly: Ukol[];
  editable: boolean;
  onOpen: () => void;
  onTaskClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `member:${clen.id}` });
  const barva = userColor(clen.colorIndex);
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-3 transition ${isOver ? "ring-2 ring-link" : ""}`}
      style={{ backgroundColor: barva }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="mb-2 w-full text-left text-base font-bold text-black/85 hover:underline"
        title="Otevřít Gantt a absence"
      >
        {clen.name}
      </button>
      <div className="space-y-1.5">
        {ukoly.map((u) => (
          <div key={u.id}>
            <DropSlot id={`before:${u.id}`} />
            <div className="rounded-md bg-black/15 p-0.5">
              <DraggableTask
                ukol={u}
                barva={barva}
                showProject
                editable={editable}
                onClick={() => onTaskClick(u.id)}
              />
            </div>
          </div>
        ))}
        <DropSlot id={`end:${clen.id}`} />
        {ukoly.length === 0 && (
          <p className="rounded-md border border-dashed border-black/25 p-2 text-center text-xs text-black/60">
            přetáhni sem úkol
          </p>
        )}
      </div>
    </div>
  );
}

function UnassignZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassign" });
  return (
    <div ref={setNodeRef} className={`min-h-[300px] flex-1 rounded-xl transition ${isOver ? "ring-2 ring-link" : ""}`}>
      {children}
    </div>
  );
}

function ProjectTile({
  projekt,
  ukoly,
  clenove,
  editable,
  onOpen,
  onTaskClick,
}: {
  projekt: Projekt;
  ukoly: Ukol[];
  clenove: Clen[];
  editable: boolean;
  onOpen: () => void;
  onTaskClick: (id: string) => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const owner = clenove.find((c) => c.id === projekt.ownerId);
  // Dlaždice projektu má barvu zodpovědného; bez něj neutrální (kap. 7).
  const tileColor = owner ? userColor(owner.colorIndex) : COLOR_TOKENS.neutral;

  async function addTask() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await vytvoritUkol(projekt.id, name);
    setBusy(false);
    if (res.ok) {
      setName("");
      setAdding(false);
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: tileColor }}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left hover:underline">
          <p className="truncate text-base font-bold text-black/85">{projekt.name}</p>
          <p className="truncate text-xs text-black/60">
            {owner ? owner.name : "bez zodpovědného"} · {projekt.zakazkaKod}
          </p>
        </button>
        {editable && (
          <button
            type="button"
            className="shrink-0 rounded-md bg-black/15 px-2 py-0.5 text-sm font-bold text-black/80 hover:bg-black/25"
            title="Přidat úkol"
            onClick={() => setAdding((v) => !v)}
          >
            +
          </button>
        )}
      </div>

      {adding && (
        <input
          className="mb-2 w-full rounded-md border-0 bg-white/80 px-2 py-1 text-sm text-black outline-none"
          placeholder="Název úkolu (Enter uloží)"
          value={name}
          autoFocus
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTask();
            if (e.key === "Escape") setAdding(false);
          }}
        />
      )}

      <div className="space-y-1.5">
        {ukoly.map((u) => {
          const resitel = clenove.find((c) => c.id === u.assigneeId);
          // Přiřazený úkol se v projektu obarví barvou řešitele (kap. 7).
          const barva = u.completed
            ? COLOR_TOKENS.neutral
            : resitel
              ? userColor(resitel.colorIndex)
              : COLOR_TOKENS.neutral;
          return (
            <DraggableTask
              key={u.id}
              ukol={u}
              barva={barva}
              showProject={false}
              editable={editable}
              onClick={() => onTaskClick(u.id)}
            />
          );
        })}
        {ukoly.length === 0 && <p className="text-xs text-black/60">Žádné úkoly.</p>}
      </div>
    </div>
  );
}
