"use client";
// Tabule zakázek – OBRÁCENÉ drag & drop oproti poptávkám: vlevo přiřaditelné
// osoby (táhnou se), vpravo zakázky (drop zóny). Přetažením osoby na zakázku se
// osoba přiřadí jako pracovník na celé období zakázky. Logika kolizí (obsazení
// u jiné akce) zůstává stejná – při konfliktu se ptá na potvrzení.
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
import { userColor } from "@erp/ui";
import { ODDELENI, ODDELENI_LABELS, KAPITOLY, KAPITOLA_LABELS, ODDELENI_KAPITOLA } from "@erp/core";
import { formatDen } from "@/lib/format";
import { pridatPracovnika, odebratPracovnika } from "@/app/(erp)/zakazky/actions";
import type { BoardOsobaZ, BoardZakazka } from "@/lib/zakazky-query";

const DUVOD_PRIDAT = "Přiřazení na tabuli";
const DUVOD_ODEBRAT = "Odebrání na tabuli";

export default function ZakazkyBoard({
  osoby,
  zakazky,
  editable,
  muzeOdebratKonstruktera,
}: {
  osoby: BoardOsobaZ[];
  zakazky: BoardZakazka[];
  editable: boolean;
  /** smí přihlášený odebrat konstruktéra ze zakázky (šéfkonstruktér / admin) */
  muzeOdebratKonstruktera: boolean;
}) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [dragged, setDragged] = useState<BoardOsobaZ | null>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Sbalená oddělení v levém sloupci (klíč oddělení, "" = bez oddělení).
  const [sbalene, setSbalene] = useState<Set<string>>(new Set());
  // Sbalené seznamy zakázek k akci (v pravém sloupci).
  const [sbaleneAkce, setSbaleneAkce] = useState<Set<string>>(new Set());
  // Potvrzení kolize (osoba obsazená u jiné akce).
  const [potvrzeni, setPotvrzeni] = useState<{ zakId: string; osobaId: string; text: string } | null>(null);

  const q = query.trim().toLowerCase();
  const osobaMatches = (o: BoardOsobaZ) => !q || o.name.toLowerCase().includes(q);
  const zakMatches = (z: BoardZakazka) =>
    !q ||
    z.kod.toLowerCase().includes(q) ||
    z.mistoPlneni.toLowerCase().includes(q) ||
    z.pracovnici.some((p) => p.name.toLowerCase().includes(q));

  const osobaById = useMemo(() => {
    const m = new Map<string, BoardOsobaZ>();
    for (const o of osoby) m.set(o.id, o);
    return m;
  }, [osoby]);

  // Zakázky seskupené pod hlavní akci (akce + její zakázky k akci).
  const skupinyZakazek = useMemo(() => {
    const idset = new Set(zakazky.map((z) => z.id));
    const detiBy = new Map<string, BoardZakazka[]>();
    for (const z of zakazky) {
      if (z.parentId && idset.has(z.parentId)) {
        if (!detiBy.has(z.parentId)) detiBy.set(z.parentId, []);
        detiBy.get(z.parentId)!.push(z);
      }
    }
    return zakazky
      .filter((z) => !z.parentId || !idset.has(z.parentId))
      .map((akce) => ({ akce, deti: detiBy.get(akce.id) ?? [] }));
  }, [zakazky]);

  // Osoby v levém sloupci: dvě kapitoly (Dílna / Kancelář) → oddělení → lidé.
  const strom = useMemo(() => {
    const perDept = new Map<string, BoardOsobaZ[]>();
    for (const o of osoby.filter(osobaMatches)) {
      const key = o.oddeleni ?? "";
      if (!perDept.has(key)) perDept.set(key, []);
      perDept.get(key)!.push(o);
    }
    type DeptUzel = { key: string; label: string; lidi: BoardOsobaZ[] };
    type KapUzel = { key: string; label: string; depts: DeptUzel[]; pocet: number };
    const kapitoly: KapUzel[] = KAPITOLY.map((kap) => {
      const depts: DeptUzel[] = ODDELENI.filter((o) => ODDELENI_KAPITOLA[o] === kap && perDept.has(o)).map((o) => ({
        key: o,
        label: ODDELENI_LABELS[o],
        lidi: perDept.get(o)!,
      }));
      return {
        key: kap,
        label: KAPITOLA_LABELS[kap],
        depts,
        pocet: depts.reduce((s, d) => s + d.lidi.length, 0),
      };
    }).filter((k) => k.depts.length > 0);
    if (perDept.has("")) {
      kapitoly.push({
        key: "_none",
        label: "Bez oddělení",
        depts: [{ key: "", label: "Bez oddělení", lidi: perDept.get("")! }],
        pocet: perDept.get("")!.length,
      });
    }
    return kapitoly;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osoby, q]);

  function prepnoutSkupinu(key: string) {
    setSbalene((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function priradit(zakId: string, osobaId: string, vynutit: boolean) {
    setBusy(true);
    setChyba(null);
    const z = zakazky.find((x) => x.id === zakId);
    if (!z) { setBusy(false); return; }
    const res = await pridatPracovnika(zakId, osobaId, z.zacatek, z.konecAktualni, DUVOD_PRIDAT, vynutit);
    setBusy(false);
    if (!res.ok) {
      if (res.potrebaPotvrzeni) {
        setPotvrzeni({ zakId, osobaId, text: res.potrebaPotvrzeni });
        return;
      }
      setChyba(res.chyba ?? "Přiřazení se nezdařilo.");
      return;
    }
    setPotvrzeni(null);
    router.refresh();
  }

  async function odebrat(prirazeniId: string) {
    if (!window.confirm("Odebrat pracovníka ze zakázky?")) return;
    setBusy(true);
    setChyba(null);
    const res = await odebratPracovnika(prirazeniId, DUVOD_ODEBRAT);
    setBusy(false);
    if (!res.ok) { setChyba(res.chyba ?? "Odebrání se nezdařilo."); return; }
    router.refresh();
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id).replace(/^osoba:/, "");
    setDragged(osobaById.get(id) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    const osoba = dragged;
    setDragged(null);
    if (!osoba || !e.over) return;
    const overId = String(e.over.id);
    if (overId.startsWith("zak:")) {
      const zakId = overId.slice(4);
      const z = zakazky.find((x) => x.id === zakId);
      if (z?.pracovnici.some((p) => p.osobaId === osoba.id)) return; // už tam je
      await priradit(zakId, osoba.id, false);
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
            placeholder="Hledat osobu / zakázku…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {q && <button className="btn-ghost" onClick={() => setQuery("")}>✕ Zrušit</button>}
      </div>

      <div className="flex gap-4">
        {/* Levá 1/3 – osoby rozdělené podle oddělení (táhnou se) */}
        <div className="w-1/3 min-w-[220px] space-y-3">
          {strom.map((kap) => {
            const kapZavreno = sbalene.has(`kap:${kap.key}`);
            return (
              <div key={kap.key} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => prepnoutSkupinu(`kap:${kap.key}`)}
                  className="flex w-full items-center gap-1 text-sm font-bold hover:text-link"
                >
                  <span className="inline-block w-3 text-xs">{kapZavreno ? "▸" : "▾"}</span>
                  {kap.label}
                  <span className="font-normal text-text-muted">({kap.pocet})</span>
                </button>
                {!kapZavreno &&
                  kap.depts.map((d) => {
                    const depZavreno = sbalene.has(`dep:${d.key}`);
                    return (
                      <div key={d.key} className="ml-3 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => prepnoutSkupinu(`dep:${d.key}`)}
                          className="flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text"
                        >
                          <span className="inline-block w-3 text-[10px]">{depZavreno ? "▸" : "▾"}</span>
                          {d.label}
                          <span className="font-normal">({d.lidi.length})</span>
                        </button>
                        {!depZavreno &&
                          d.lidi.map((o) => (
                            <OsobaChip
                              key={o.id}
                              osoba={o}
                              editable={editable}
                              onOpen={() => router.push(`/lide/${o.id}`)}
                            />
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })}
          {osoby.length === 0 && (
            <p className="text-sm text-text-muted">Žádné osoby. Přidej uživatele ve Správě.</p>
          )}
          {osoby.length > 0 && strom.length === 0 && (
            <p className="text-sm text-text-muted">Nikdo neodpovídá hledání.</p>
          )}
        </div>

        {/* Pravá 2/3 – zakázky (drop zóny) */}
        <div className="flex-1">
          <div className="columns-1 gap-3 md:columns-2 2xl:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
            {skupinyZakazek
              .filter((g) => zakMatches(g.akce) || g.deti.some(zakMatches))
              .map((g) => (
                <div key={g.akce.id}>
                  <ZakazkaTile
                    zakazka={g.akce}
                    editable={editable}
                    muzeOdebratKonstruktera={muzeOdebratKonstruktera}
                    onOpen={() => router.push(`/zakazky/${g.akce.id}`)}
                    onOpenOsoba={(osobaId) => router.push(`/lide/${osobaId}`)}
                    onRemove={odebrat}
                  />
                  {g.deti.length > 0 && (
                    <div className="ml-3 mt-1 border-l-2 border-link/40 pl-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSbaleneAkce((s) => {
                            const n = new Set(s);
                            if (n.has(g.akce.id)) n.delete(g.akce.id);
                            else n.add(g.akce.id);
                            return n;
                          })
                        }
                        className="flex items-center gap-1 py-1 text-xs font-medium text-text-muted hover:text-text"
                      >
                        <span className="inline-block w-3">{sbaleneAkce.has(g.akce.id) ? "▸" : "▾"}</span>
                        Zakázky k akci ({g.deti.length})
                      </button>
                      {!sbaleneAkce.has(g.akce.id) && (
                        <div className="mt-1 space-y-2">
                          {g.deti.map((d) => (
                            <ZakazkaTile
                              key={d.id}
                              zakazka={d}
                              editable={editable}
                              muzeOdebratKonstruktera={muzeOdebratKonstruktera}
                              onOpen={() => router.push(`/zakazky/${d.id}`)}
                              onOpenOsoba={(osobaId) => router.push(`/lide/${osobaId}`)}
                              onRemove={odebrat}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
          {skupinyZakazek.filter((g) => zakMatches(g.akce) || g.deti.some(zakMatches)).length === 0 && (
            <p className="text-sm text-text-muted">
              {q ? "Nic neodpovídá hledání." : "Žádné otevřené zakázky."}
            </p>
          )}
        </div>
      </div>

      <DragOverlay>
        {dragged && (
          <div
            className="rounded-md px-3 py-1.5 text-sm font-semibold shadow-lg"
            style={{ backgroundColor: userColor(dragged.colorIndex), color: "#16181b" }}
          >
            {dragged.name}
          </div>
        )}
      </DragOverlay>

      {busy && <p className="mt-2 text-xs text-text-muted">Ukládám…</p>}

      {/* Potvrzení kolize */}
      {potvrzeni && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-base font-semibold">Kolize termínu</h2>
            <p className="text-sm">{potvrzeni.text}</p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setPotvrzeni(null)} disabled={busy}>
                Zrušit
              </button>
              <button
                className="btn-primary"
                onClick={() => priradit(potvrzeni.zakId, potvrzeni.osobaId, true)}
                disabled={busy}
              >
                Přidat i tak
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

function OsobaChip({ osoba, editable, onOpen }: { osoba: BoardOsobaZ; editable: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `osoba:${osoba.id}`,
    disabled: !editable,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onDoubleClick={onOpen}
      className={`rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition ${isDragging ? "opacity-40" : ""} ${editable ? "cursor-grab hover:brightness-110" : ""}`}
      style={{ backgroundColor: userColor(osoba.colorIndex), color: "#16181b" }}
      title={editable ? "Přetáhni na zakázku · dvojklik = karta zaměstnance" : "Dvojklik = karta zaměstnance"}
    >
      {osoba.name}
    </div>
  );
}

function ZakazkaTile({
  zakazka,
  editable,
  muzeOdebratKonstruktera,
  onOpen,
  onOpenOsoba,
  onRemove,
}: {
  zakazka: BoardZakazka;
  editable: boolean;
  muzeOdebratKonstruktera: boolean;
  onOpen: () => void;
  onOpenOsoba: (osobaId: string) => void;
  onRemove: (prirazeniId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `zak:${zakazka.id}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-line bg-surface p-3 transition ${isOver ? "ring-2 ring-link" : ""}`}
    >
      <button type="button" onClick={onOpen} className="mb-1 block text-left hover:underline">
        <p className="font-bold">{zakazka.kod}</p>
        <p className="text-xs text-text-muted">{zakazka.popis || zakazka.mistoPlneni}</p>
      </button>
      <p className="mb-2 text-[11px] text-text-muted">
        {formatDen(zakazka.zacatek)} – {formatDen(zakazka.konecAktualni)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {zakazka.pracovnici.map((p) => (
          <span
            key={p.prirazeniId}
            onDoubleClick={() => onOpenOsoba(p.osobaId)}
            title="Dvojklik = karta zaměstnance"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: userColor(p.colorIndex), color: "#16181b" }}
          >
            {p.name}
            {editable &&
              (p.oddeleni === "konstrukce" && !muzeOdebratKonstruktera ? (
                <span className="text-black/40" data-tip="Konstruktéra smí odebrat jen šéfkonstruktér nebo administrátor" data-tip-pos="bottom">
                  🔒
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onRemove(p.prirazeniId)}
                  className="text-black/60 hover:text-black"
                  data-tip="Odebrat pracovníka ze zakázky"
                  data-tip-pos="bottom"
                >
                  ✕
                </button>
              ))}
          </span>
        ))}
        {zakazka.pracovnici.length === 0 && (
          <span className="rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-text-muted">
            přetáhni sem osobu
          </span>
        )}
      </div>
    </div>
  );
}
