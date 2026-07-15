"use client";
// Tlačítko tiskového dialogu prohlížeče ("Uložit jako PDF"). V tisku skryté.
import { useEffect } from "react";

export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <div className="mb-4 flex gap-2 print:hidden">
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        🖨 Tisk / Uložit jako PDF
      </button>
      <button
        onClick={() => window.history.back()}
        className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100"
      >
        Zpět
      </button>
    </div>
  );
}
