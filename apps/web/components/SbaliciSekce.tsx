"use client";
// Sbalitelná sekce s vlastním nadpisem. Ve výchozím stavu je sbalená; jakmile
// ji uživatel rozbalí, volba se pamatuje v prohlížeči podle klíče `persistKey`
// a platí napříč záznamy (např. „Milníky" u všech zakázek), aby detail
// nezahltil obrazovku.
import { useState, useEffect, useRef, type ReactNode } from "react";

export function SbaliciSekce({
  titul,
  persistKey,
  vychoziOtevreno = false,
  karta = true,
  akce,
  children,
}: {
  titul: string;
  persistKey: string;
  vychoziOtevreno?: boolean;
  /** true = obalí do karty (card p-4); false = jen nadpis, obsah si nese vlastní styl. */
  karta?: boolean;
  /** volitelný prvek vpravo v hlavičce (např. počet položek). */
  akce?: ReactNode;
  children: ReactNode;
}) {
  const ulozKlic = `erp_sekce_${persistKey}`;
  const [otevreno, setOtevreno] = useState(vychoziOtevreno);
  const nacteno = useRef(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(ulozKlic);
      if (v === "0") setOtevreno(false);
      else if (v === "1") setOtevreno(true);
    } catch {
      /* localStorage nemusí být dostupný */
    }
    nacteno.current = true;
  }, [ulozKlic]);

  useEffect(() => {
    if (!nacteno.current) return;
    try {
      localStorage.setItem(ulozKlic, otevreno ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [otevreno, ulozKlic]);

  return (
    <section className={karta ? "card p-4" : ""}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOtevreno((o) => !o)}
          aria-expanded={otevreno}
          className="flex flex-1 items-center gap-2 text-left"
          title={otevreno ? "Sbalit" : "Rozbalit"}
        >
          <span
            className="inline-block text-text-muted transition-transform"
            style={{ transform: otevreno ? "rotate(90deg)" : "none" }}
            aria-hidden
          >
            ▸
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{titul}</h2>
        </button>
        {akce}
      </div>
      {otevreno && <div className="mt-3">{children}</div>}
    </section>
  );
}
