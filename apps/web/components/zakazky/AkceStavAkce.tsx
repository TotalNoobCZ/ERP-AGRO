"use client";
// Životní cyklus akce v hlavičce detailu: běží → Hotovo (do fakturace / uzavřít
// bez fakturace) → Fakturace → Proplaceno → Archiv. Volá server action zmenitStav.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zmenitStav } from "@/app/(erp)/zakazky/actions";
import type { StavZakazky } from "@erp/core";

export function AkceStavAkce({ id, stav }: { id: string; stav: StavZakazky }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hotovoOpen, setHotovoOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hotovoOpen) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setHotovoOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [hotovoOpen]);

  async function zmen(s: "FAKTURACE" | "PROPLACENO" | "ARCHIV" | "AKTIVNI") {
    setBusy(true);
    await zmenitStav(id, s);
    setBusy(false);
    setHotovoOpen(false);
    router.refresh();
  }

  if (stav === "AKTIVNI" || stav === "POZASTAVENO") {
    return (
      <div ref={wrapRef} className="relative">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => setHotovoOpen((v) => !v)}>
          ✓ Hotovo
        </button>
        {hotovoOpen && (
          <div className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-md border border-line bg-surface shadow-lg">
            <button
              type="button"
              disabled={busy}
              onClick={() => zmen("FAKTURACE")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-40"
            >
              🧾 Poslat do fakturace
              <span className="block text-xs text-text-muted">akce se bude fakturovat · uvolní dělníky</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => zmen("ARCHIV")}
              className="block w-full border-t border-line px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-40"
            >
              ✓ Uzavřít bez fakturace
              <span className="block text-xs text-text-muted">nefakturuje se – rovnou hotové</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (stav === "FAKTURACE") {
    return (
      <>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => zmen("PROPLACENO")}>
          ✓ Označit proplaceno
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => zmen("AKTIVNI")}>
          Zpět do výroby
        </button>
      </>
    );
  }

  if (stav === "PROPLACENO") {
    return (
      <>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => zmen("FAKTURACE")}>
          Zpět do fakturace
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => zmen("ARCHIV")}>
          Archivovat
        </button>
      </>
    );
  }

  // ARCHIV
  return (
    <button type="button" className="btn-ghost" disabled={busy} onClick={() => zmen("AKTIVNI")}>
      Znovu aktivovat
    </button>
  );
}
