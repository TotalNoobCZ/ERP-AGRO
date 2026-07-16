"use client";
// Okamžitá zpětná vazba na klik odkazu (např. tab v podnavigaci): dokud se
// cílová stránka načítá, ukáže u odkazu malý spinner. Musí být uvnitř <Link>.
import { useLinkStatus } from "next/link";

export function LinkSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="ml-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent align-[-1px]" />
  );
}
