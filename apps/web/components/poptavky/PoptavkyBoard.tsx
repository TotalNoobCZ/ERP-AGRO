"use client";
// Tabule poptávek: vlevo dlaždice odpovědných osob (Vedoucí / Projekťák),
// vpravo seznam otevřených poptávek. Přiřazení = drag & drop karty na osobu
// (stejný princip jako přiřazování úkolů v Konstrukci).
import { useMemo, useState } from "react";
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
import { INQUIRY_STATUS_LABELS } from "@erp/core";
import { COLOR_TOKENS, userColor } from "@erp/ui";
import { formatDen } from "@/lib/format";
import { DateField } from "@/components/DateField";
import { priraditPoptavku } from "@/app/(erp)/poptavky/actions";
import type { BoardOsoba, BoardPoptavka } from "@/lib/poptavky-query";

export default function PoptavkyBoard({
  osoby,
  poptavky,
  editable,
}: {
  osoby: BoardOsoba[];
  poptavky: BoardPoptavka[];
  editable: boolean;
}) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [dragged, setDragged] = useState<BoardPoptavka | null>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Vyžádání termínu při přidělení poptávky bez termínu.
  const [terminPending, setTerminPending] = useState<{ inquiryId: string; personId: string; label: string; osoba: string } | null>(null);
  const [terminVal, setTerminVal] = useState("");

  const q = query.trim().toLowerCase();
  const matches = (p: BoardPoptavka) =>
    !q ||
    p.subject.toLowerCase().includes(q) ||
    p.customerName.toLowerCase().includes(q) ||
    String(p.number).includes(q);

  const barvaOsoby = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const o of osoby) m.set(o.id, o.colorIndex);
    return m;
  }, [osoby]);

  const cardColor = (p: BoardPoptavka): string =>
    p.personId && barvaOsoby.has(p.personId)
      ? userColor(barvaOsoby.get(p.personId) ?? null)
      : COLOR_TOKENS.neutral;

  const poptavkyOsoby = useMemo(() => {
    const map = new Map<string, BoardPoptavka[]>();
    for (const o of osoby) map.set(o.id, []);
    for (const p of poptavky) {
      if (p.personId && map.has(p.personId)) map.get(p.personId)!.push(p);
    }
    return map;
  }, [osoby, poptavky]);

  // Pravý sloupec = nepřidělené poptávky (bez osoby nebo s osobou mimo dlaždice).
  // Jakmile poptávku přiřadíš, z pravého sloupce zmizí a zůstane jen v dlaždici.
  const nezarazene = useMemo(
    () => poptavky.filter((p) => !p.personId || !barvaOsoby.has(p.personId)),
    [poptavky, barvaOsoby],
  );

  async function priradit(inquiryId: string, personId: string, deadline?: string) {
    setBusy(true);
    setChyba(null);
    const res = await priraditPoptavku(inquiryId, personId, deadline);
    setBusy(false);
    if (!res.ok) {
      // Přidělená poptávka nemůže být bez termínu → vyžádáme si ho v okně.
      if (res.needsDeadline) {
        const p = poptavky.find((x) => x.id === inquiryId);
        const o = osoby.find((x) => x.id === personId);
        setTerminVal("");
        setTerminPending({
          inquiryId,
          personId,
          label: p ? `#${p.number} · ${p.subject}` : "poptávka",
          osoba: o?.name ?? "osobě",
        });
        return;
      }
      setChyba(res.error ?? "Přiřazení se nezdařilo.");
      return;
    }
    setTerminPending(null);
    router.refresh();
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id).replace(/^popt:/, "");
    setDragged(poptavky.find((p) => p.id === id) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    const card = dragged;
    setDragged(null);
    if (!card || !e.over) return;
    const overId = String(e.over.id);
    if (overId.startsWith("person:")) {
      const personId = overId.slice(7);
      if (card.personId === personId) return;
      await priradit(card.id, personId);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {chyba && <p className="err mb-2">{chyba}</p>}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <span className="absolute left-2.5 top-2 text-text-muted">🔍</span>
          <input
            className="field pl-8"
            placeholder="Hledat poptávku / zákazníka…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {q && <button className="btn-ghost" onClick={() => setQuery("")}>✕ Zrušit</button>}
      </div>

      <div className="flex gap-4">
        {/* Levá 1/3 – dlaždice osob */}
        <div className="w-1/3 min-w-[240px] space-y-3">
          {osoby.map((o) => (
            <PersonTile
              key={o.id}
              osoba={o}
              poptavky={(poptavkyOsoby.get(o.id) ?? []).filter(matches)}
              editable={editable}
              onOpen={(id) => router.push(`/poptavky/${id}`)}
            />
          ))}
          {osoby.length === 0 && (
            <p className="text-sm text-text-muted">
              Žádné odpovědné osoby. Ve Správě dej někomu roli „Vedoucí" nebo oddělení „Projekťák".
            </p>
          )}
        </div>

        {/* Pravá 2/3 – nepřidělené otevřené poptávky */}
        <div className="flex-1">
          <div className="columns-1 gap-3 md:columns-2 2xl:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
            {nezarazene.filter(matches).map((p) => (
              <PoptCard
                key={p.id}
                popt={p}
                barva={cardColor(p)}
                editable={editable}
                onOpen={() => router.push(`/poptavky/${p.id}`)}
              />
            ))}
          </div>
          {nezarazene.filter(matches).length === 0 && (
            <p className="text-sm text-text-muted">
              {q ? "Nic neodpovídá hledání." : "Všechny otevřené poptávky jsou přidělené. 🎉"}
            </p>
          )}
        </div>
      </div>

      <DragOverlay>
        {dragged && (
          <div className="w-56 rounded-md border border-line bg-surface p-2 text-sm shadow-lg">
            <p className="font-medium">#{dragged.number} · {dragged.subject}</p>
            <p className="text-xs text-text-muted">{dragged.customerName}</p>
          </div>
        )}
      </DragOverlay>

      {busy && <p className="mt-2 text-xs text-text-muted">Ukládám…</p>}

      {terminPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-base font-semibold">Zadej termín poptávky</h2>
            <p className="mt-1 text-sm text-text-muted">
              Přidělovaná poptávka <span className="font-medium text-text">{terminPending.label}</span>{" "}
              ({terminPending.osoba}) zatím nemá termín. Přidělená poptávka nemůže existovat bez termínu.
            </p>
            <div className="mt-4">
              <label className="label">Termín nabídky</label>
              <DateField value={terminVal} onChange={setTerminVal} />
            </div>
            {chyba && <p className="err mt-2">{chyba}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setTerminPending(null)} disabled={busy}>
                Zrušit
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !terminVal}
                onClick={() => priradit(terminPending.inquiryId, terminPending.personId, terminVal)}
              >
                {busy ? "Ukládám…" : "Přidělit s termínem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

function PersonTile({
  osoba,
  poptavky,
  editable,
  onOpen,
}: {
  osoba: BoardOsoba;
  poptavky: BoardPoptavka[];
  editable: boolean;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `person:${osoba.id}` });
  const barva = userColor(osoba.colorIndex);
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-3 transition ${isOver ? "ring-2 ring-link" : ""}`}
      style={{ backgroundColor: barva }}
    >
      <p className="mb-2 text-base font-bold text-black/85">
        {osoba.name} <span className="font-normal text-black/60">({poptavky.length})</span>
      </p>
      <div className="space-y-1.5">
        {poptavky.map((p) => (
          <div key={p.id} className="rounded-md bg-black/15 p-0.5">
            <PoptCard popt={p} barva={barva} editable={editable} onOpen={() => onOpen(p.id)} />
          </div>
        ))}
        {poptavky.length === 0 && (
          <p className="rounded-md border border-dashed border-black/25 p-2 text-center text-xs text-black/60">
            přetáhni sem poptávku
          </p>
        )}
      </div>
    </div>
  );
}

function PoptCard({
  popt,
  barva,
  editable,
  onOpen,
}: {
  popt: BoardPoptavka;
  barva: string;
  editable: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `popt:${popt.id}`,
    disabled: !editable,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={`cursor-pointer rounded-md p-2 text-sm shadow-sm transition ${isDragging ? "opacity-40" : ""} ${editable ? "hover:brightness-110" : ""}`}
      style={{ backgroundColor: barva, color: "#16181b" }}
      title={popt.subject}
    >
      <p className="truncate font-semibold">#{popt.number} · {popt.subject}</p>
      <p className="truncate text-xs opacity-75">{popt.customerName}</p>
      <div className="mt-0.5 flex items-center justify-between text-[10px] opacity-70">
        <span>{INQUIRY_STATUS_LABELS[popt.status]}</span>
        {popt.deadline && <span>do {formatDen(popt.deadline)}</span>}
      </div>
    </div>
  );
}
