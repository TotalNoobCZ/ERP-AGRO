"use client";
// Filtrovací panel nad tabulkou poptávek – stav filtrů žije v URL
// (1:1 z Popt-vky/components/inquiry-filters.tsx + filter-restore.tsx).
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Input, Button, Select } from "@/components/ui";
import { INQUIRY_STATUS_ORDER, INQUIRY_STATUS_LABELS } from "@erp/core";

type Person = { id: string; name: string };

export function InquiryFilters({ persons }: { persons: Person[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");

  // Nastaví/odebere parametr v URL; poslední filtr se pamatuje v localStorage.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    try {
      if (qs) localStorage.setItem("poptavky_filter", qs);
      else localStorage.removeItem("poptavky_filter");
    } catch {}
    router.push(`/poptavky?${qs}`);
  }

  function clearFilters() {
    try {
      localStorage.removeItem("poptavky_filter");
    } catch {}
    router.push("/poptavky");
  }

  // Debounce vyhledávání – 350 ms od posledního stisku klávesy.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) setParam("q", q);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const status = params.get("status") ?? "";
  const personId = params.get("personId") ?? "";
  const deadline = params.get("deadline") ?? "";
  const sort = params.get("sort") ?? "number_desc";
  const hasFilters = q || status || personId || deadline || sort !== "number_desc";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <span className="absolute left-2.5 top-2 text-muted-foreground">🔍</span>
        <Input
          className="pl-8"
          placeholder="Hledat v předmětu, popisu, zákazníkovi…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Select className="w-auto" value={status} onChange={(e) => setParam("status", e.target.value)}>
        <option value="">Všechny stavy</option>
        {INQUIRY_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>
        ))}
      </Select>

      <Select className="w-auto" value={personId} onChange={(e) => setParam("personId", e.target.value)}>
        <option value="">Všechny osoby</option>
        {persons.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </Select>

      <Select className="w-auto" value={deadline} onChange={(e) => setParam("deadline", e.target.value)}>
        <option value="">Termín: vše</option>
        <option value="overdue">Po termínu</option>
        <option value="upcoming">V termínu</option>
      </Select>

      <Select className="w-auto" value={sort} onChange={(e) => setParam("sort", e.target.value)}>
        <option value="number_desc">ID ↓ (nejnovější)</option>
        <option value="number">ID ↑ (nejstarší)</option>
        <option value="deadline">Termín ↑</option>
        <option value="deadline_desc">Termín ↓</option>
        <option value="received_desc">Nejnovější příjem</option>
        <option value="received">Nejstarší příjem</option>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          ✕ Zrušit filtry
        </Button>
      )}
    </div>
  );
}

/** Obnoví poslední uložený filtr, když uživatel přijde bez parametrů. */
export function FilterRestore() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.search) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("poptavky_filter");
    } catch {}
    if (saved) router.replace(`/poptavky?${saved}`);
  }, [router]);
  return null;
}
