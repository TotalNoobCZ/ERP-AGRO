"use client";
// Tlačítko „Konstrukce" na poptávce: zapnutí propíše poptávku do Konstrukce
// (založí projekt se základním infem), vypnutí projekt archivuje.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepnoutKonstrukci } from "@/app/(erp)/poptavky/actions";

export function KonstrukceToggle({
  inquiryId,
  aktivni,
  editable,
}: {
  inquiryId: string;
  aktivni: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!editable) {
    return aktivni ? (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-link/50 bg-link/10 px-3 py-1.5 text-sm font-semibold text-link">
        📐 V konstrukci
      </span>
    ) : null;
  }

  async function prepnout() {
    if (aktivni && !confirm("Vypnout konstrukci pro tuto poptávku? Její konstrukční projekt se archivuje (jde obnovit v archivu Konstrukce).")) {
      return;
    }
    setBusy(true);
    const res = await prepnoutKonstrukci(inquiryId);
    setBusy(false);
    if (!res.ok) {
      alert(res.chyba ?? "Nepovedlo se.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={prepnout}
      disabled={busy}
      data-tip={
        aktivni
          ? "Poptávka je propsaná do Konstrukce – kliknutím ji z konstrukce vyjmeš (projekt se archivuje)"
          : "Propsat poptávku do Konstrukce – konstruktéři si ji rozdělí na úkoly jako u zakázek"
      }
      className={`btn-ghost ${aktivni ? "border-link bg-link/10 text-link" : ""}`}
    >
      📐 {busy ? "Ukládám…" : aktivni ? "V konstrukci ✓" : "Konstrukce"}
    </button>
  );
}
