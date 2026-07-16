"use client";
// Živé filtry seznamu akcí (jako Poptávky): stav filtrů v URL, paměť
// posledního filtru (localStorage), debounce hledání, export do PDF.
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input, Select, Button } from "@/components/ui";

const KEY = "zakazky_filter";

export function ZakazkyFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    try {
      if (qs) localStorage.setItem(KEY, qs);
      else localStorage.removeItem(KEY);
    } catch {}
    router.push(`/zakazky?${qs}`);
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
  const hasFilters = q || stav || priorita;
  const exportQs = params.toString();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <span className="absolute left-2.5 top-2 text-text-muted">🔍</span>
        <Input className="pl-8" placeholder="Hledat (číslo / místo)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Select className="w-auto" value={stav} onChange={(e) => setParam("stav", e.target.value)}>
        <option value="">Všechny stavy</option>
        <option value="AKTIVNI">Aktivní</option>
        <option value="PO_TERMINU">Po termínu</option>
        <option value="POZASTAVENO">Pozastaveno</option>
        <option value="DOKONCENO">Dokončeno</option>
        <option value="ARCHIV">Archiv</option>
      </Select>

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
