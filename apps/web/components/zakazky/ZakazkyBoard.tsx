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
import { usePersistentSet } from "@/lib/usePersistentSet";
import { pridatPracovnika, odebratPracovnika, nastavitOdpovednouOsobu } from "@/app/(erp)/zakazky/actions";
import type { BoardOsobaZ, BoardZakazka } from "@/lib/zakazky-query";

/** Odpovědná osoba zakázky = Projekťák (oddělení) nebo role Vedoucí. */
function jeOdpovednaKandidat(o: BoardOsobaZ): boolean {
  return o.oddeleni === "projektak" || o.role === "vedouci";
}

const DUVOD_PRIDAT = "Přiřazení na tabuli";
const DUVOD_ODEBRAT = "Odebrání na tabuli";

export default function ZakazkyBoard({
  osoby,
  zakazky,
  editable,
  muzeOdebratKonstruktera,
  zakazkaBasePath = "/zakazky",
}: {
  osoby: BoardOsobaZ[];
  zakazky: BoardZakazka[];
  editable: boolean;
  /** smí přihlášený odebrat konstruktéra ze zakázky (šéfkonstruktér / admin) */
  muzeOdebratKonstruktera: boolean;
  /** kam vede kliknutí na zakázku (Zakázky vs. Dílna mají vlastní detail) */
  zakazkaBasePath?: string;
}) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [dragged, setDragged] = useState<BoardOsobaZ | null>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Sbalená oddělení v levém sloupci (klíč oddělení, "" = bez oddělení).
  const { has: jeSbaleno, toggle: prepnoutSkupinu } = usePersistentSet("erp_zakazky_tabule_sbalene");
  // Sbalené seznamy zakázek k akci (v pravém sloupci).
  const { has: jeAkceSbalena, toggle: prepnoutAkci } = usePersistentSet("erp_zakazky_tabule_sbaleneAkce");
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

  // Odpovědné osoby (projekťák / vedoucí) – samostatná skupina; přetažením se
  // zaevidují jako odpovědná osoba zakázky (ne jako pracovník).
  const odpovedneOsoby = useMemo(
    () => osoby.filter(osobaMatches).filter(jeOdpovednaKandidat),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [osoby, q],
  );

  // Osoby v levém sloupci: dvě kapitoly (Dílna / Kancelář) → oddělení → lidé.
  // Odpovědné osoby (projekťák/vedoucí) sem nepatří – mají vlastní skupinu výše.
  const strom = useMemo(() => {
    const perDept = new Map<string, BoardOsobaZ[]>();
    for (const o of osoby.filter(osobaMatches)) {
      if (jeOdpovednaKandidat(o)) continue;
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

  async function nastavitOdpovednou(zakId: string, osobaId: string | null) {
    setBusy(true);
    setChyba(null);
    const res = await nastavitOdpovednouOsobu(zakId, osobaId);
    setBusy(false);
    if (!res.ok) { setChyba(res.chyba ?? "Uložení se nezdařilo."); return; }
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
      // Projekťák / vedoucí → odpovědná osoba; ostatní → pracovník.
      if (jeOdpovednaKandidat(osoba)) {
        if (z?.odpovednaOsobaId === osoba.id) return; // už je odpovědná
        await nastavitOdpovednou(zakId, osoba.id);
        return;
      }
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
          {/* Odpovědné osoby (projekťák / vedoucí) – přetažením = odpovědná osoba. */}
          {odpovedneOsoby.length > 0 && (() => {
            const zavreno = jeSbaleno("kap:_odpovedne");
            return (
              <div className="space-y-1.5 rounded-lg border border-link/30 bg-link/5 p-2">
                <button
                  type="button"
                  onClick={() => prepnoutSkupinu("kap:_odpovedne")}
                  className="flex w-full items-center gap-1 text-sm font-bold hover:text-link"
                >
                  <span className="inline-block w-3 text-xs">{zavreno ? "▸" : "▾"}</span>
                  ⭐ Odpovědné osoby
                  <span className="font-normal text-text-muted">({odpovedneOsoby.length})</span>
                </button>
                {!zavreno && (
                  <>
                    <p className="text-[11px] text-text-muted">Projekťák / vedoucí – přetažením na zakázku = odpovědná osoba.</p>
                    {odpovedneOsoby.map((o) => (
                      <OsobaChip key={o.id} osoba={o} editable={editable} onOpen={() => router.push(`/lide/${o.id}`)} />
                    ))}
                  </>
                )}
              </div>
            );
          })()}
          {strom.map((kap) => {
            const kapZavreno = jeSbaleno(`kap:${kap.key}`);
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
                    const depZavreno = jeSbaleno(`dep:${d.key}`);
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
                    onOpen={() => router.push(`${zakazkaBasePath}/${g.akce.id}`)}
                    onOpenOsoba={(osobaId) => router.push(`/lide/${osobaId}`)}
                    onRemove={odebrat}
                    onRemoveOdpovedna={() => nastavitOdpovednou(g.akce.id, null)}
                  />
                  {g.deti.length > 0 && (
                    <div className="ml-3 mt-1 border-l-2 border-link/40 pl-3">
                      <button
                        type="button"
                        onClick={() => prepnoutAkci(g.akce.id)}
                        className="flex items-center gap-1 py-1 text-xs font-medium text-text-muted hover:text-text"
                      >
                        <span className="inline-block w-3">{jeAkceSbalena(g.akce.id) ? "▸" : "▾"}</span>
                        Zakázky k akci ({g.deti.length})
                      </button>
                      {!jeAkceSbalena(g.akce.id) && (
                        <div className="mt-1 space-y-2">
                          {g.deti.map((d) => (
                            <ZakazkaTile
                              key={d.id}
                              zakazka={d}
                              editable={editable}
                              muzeOdebratKonstruktera={muzeOdebratKonstruktera}
                              onOpen={() => router.push(`${zakazkaBasePath}/${d.id}`)}
                              onOpenOsoba={(osobaId) => router.push(`/lide/${osobaId}`)}
                              onRemove={odebrat}
                              onRemoveOdpovedna={() => nastavitOdpovednou(d.id, null)}
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
  onRemoveOdpovedna,
}: {
  zakazka: BoardZakazka;
  editable: boolean;
  muzeOdebratKonstruktera: boolean;
  onOpen: () => void;
  onOpenOsoba: (osobaId: string) => void;
  onRemove: (prirazeniId: string) => void;
  onRemoveOdpovedna: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `zak:${zakazka.id}` });
  const odp = zakazka.odpovednaOsoba;
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

      {/* Odpovědná osoba – samostatně nad pracovníky. */}
      <div className="mb-2">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Odpovědná osoba</p>
        {odp ? (
          <span
            onDoubleClick={() => onOpenOsoba(odp.id)}
            data-tip="Dvojklik = karta zaměstnance"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-black/10"
            style={{ backgroundColor: userColor(odp.colorIndex), color: "#16181b" }}
          >
            ⭐ {odp.name}
            {editable && (
              <button
                type="button"
                onClick={onRemoveOdpovedna}
                className="text-black/60 hover:text-black"
                data-tip="Zrušit odpovědnou osobu"
                data-tip-pos="bottom"
              >
                ✕
              </button>
            )}
          </span>
        ) : (
          <span className="inline-block rounded-md border border-dashed border-link/50 px-2 py-0.5 text-xs text-text-muted">
            přetáhni sem projekťáka / vedoucího
          </span>
        )}
      </div>

      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Pracovníci</p>
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
