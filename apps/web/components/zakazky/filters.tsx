"use client";
// Živé filtry seznamu akcí (jako Poptávky): stav filtrů v URL, paměť
// posledního filtru (localStorage), debounce hledání, export do PDF.
// Stavy = multi-výběr: vyber jeden (jen ten) nebo víc (všechny kromě zbytku).
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input, Select, Button } from "@/components/ui";
import { ZAKAZKA_STAVY, ZAKAZKA_STAV_LABELS } from "@erp/core";

const KEY = "zakazky_filter";

export function ZakazkyFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function push(next: URLSearchParams) {
    const qs = next.toString();
    try {
      if (qs) localStorage.setItem(KEY, qs);
      else localStorage.removeItem(KEY);
    } catch {}
    router.push(`/zakazky${qs ? `?${qs}` : ""}`);
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  function clearFilters() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    router.push("/zakazky");
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) setParam("q", q);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const stav = params.get("stav") ?? "";
  const priorita = params.get("priorita") ?? "";
  const vybraneStavy = new Set((params.get("stavy") ?? "").split(",").filter(Boolean));
  const poTerminu = stav === "PO_TERMINU";
  const hasFilters = q || stav || priorita || vybraneStavy.size > 0;

  // Přepnutí jednoho stavu v multi-výběru (zruší případný „Po termínu").
  function toggleStav(s: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("stav");
    const set = new Set((next.get("stavy") ?? "").split(",").filter(Boolean));
    if (set.has(s)) set.delete(s);
    else set.add(s);
    if (set.size) next.set("stavy", [...set].join(","));
    else next.delete("stavy");
    push(next);
  }

  function togglePoTerminu() {
    const next = new URLSearchParams(params.toString());
    next.delete("stavy");
    if (poTerminu) next.delete("stav");
    else next.set("stav", "PO_TERMINU");
    push(next);
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-medium transition ${
      active
        ? "border-link bg-link/10 text-link"
        : "border-input text-text-muted hover:bg-accent hover:text-text"
    }`;

  const exportQs = params.toString();

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <span className="absolute left-2.5 top-2 text-text-muted">🔍</span>
          <Input className="pl-8" placeholder="Hledat (název / místo)…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <Select className="w-auto" value={priorita} onChange={(e) => setParam("priorita", e.target.value)}>
          <option value="">Priorita: vše</option>
          <option value="1">1 – nejvyšší</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5 – nejnižší</option>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>✕ Zrušit filtry</Button>
        )}

        <a
          href={`/zakazky/tisk?${exportQs ? `${exportQs}&` : ""}print=1`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          🖨 Export do PDF
        </a>
      </div>

      {/* Stavy – multi-výběr. Nic vybráno = vše kromě archivu. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-text-muted">Stavy:</span>
        {ZAKAZKA_STAVY.map((s) => (
          <button key={s} type="button" className={chip(vybraneStavy.has(s))} onClick={() => toggleStav(s)}>
            {ZAKAZKA_STAV_LABELS[s]}
          </button>
        ))}
        <button type="button" className={chip(poTerminu)} onClick={togglePoTerminu}>
          Po termínu
        </button>
        {vybraneStavy.size > 0 && (
          <span className="text-xs text-text-muted">
            (zobrazují se jen vybrané{vybraneStavy.size === 1 ? " – 1 stav" : ` – ${vybraneStavy.size} stavy`})
          </span>
        )}
      </div>
    </div>
  );
}

/** Obnoví poslední uložený filtr, když uživatel přijde bez parametrů. */
export function ZakazkyFilterRestore() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.search) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    if (saved) router.replace(`/zakazky?${saved}`);
  }, [router]);
  return null;
}
