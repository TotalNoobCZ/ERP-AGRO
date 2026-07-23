"use client";
// Tlačítka posunu akce ve fakturaci: Fakturace → Proplaceno (finále) → Archiv,
// s možností kroku zpět. Volá server action zmenitStav.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { zmenitStav } from "@/app/(erp)/zakazky/actions";
import type { StavZakazky } from "@erp/core";

export function FakturaceAkce({ id, stav }: { id: string; stav: StavZakazky }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function zmen(s: "FAKTURACE" | "PROPLACENO" | "ARCHIV") {
    setBusy(true);
    await zmenitStav(id, s);
    setBusy(false);
    router.refresh();
  }

  const btn = "rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stav === "FAKTURACE" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => zmen("PROPLACENO")}
          className={`${btn} border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >
          ✓ Proplaceno
        </button>
      )}
      {stav === "PROPLACENO" && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => zmen("FAKTURACE")}
            className={`${btn} border-input text-text-muted hover:bg-accent`}
          >
            ↩ Zpět do fakturace
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => zmen("ARCHIV")}
            className={`${btn} border-input text-text-muted hover:bg-accent`}
          >
            Archivovat
          </button>
        </>
      )}
    </div>
  );
}
