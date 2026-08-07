"use client";
// Hledání v seznamu zaměstnanců – živý zápis do URL (?q=), server filtruje.
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function LideHledani() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  // Debounce: piš do URL až po chvilce klidu.
  useEffect(() => {
    const t = setTimeout(() => {
      const cil = q.trim() ? `/lide?q=${encodeURIComponent(q.trim())}` : "/lide";
      router.replace(cil);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative max-w-xs">
      <span className="absolute left-2.5 top-2 text-text-muted">🔍</span>
      <input
        className="field pl-8"
        placeholder="Hledat jméno / pozici…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </div>
  );
}
