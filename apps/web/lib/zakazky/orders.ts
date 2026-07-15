// Odvozený stav "Po termínu" a barvy stavů zakázky.
// Převzato z Planovani/src/lib/orders.ts (bez Prisma; typ z @erp/core,
// labely z @erp/core/zakazky – tady jen odvozené funkce a barvy).
import type { StavZakazky } from "@erp/core";
import { ZAKAZKA_STAV_LABELS } from "@erp/core";
import { today } from "./dates";

export type StavovaZakazka = { konecAktualni: Date; stav: StavZakazky };

/** "Po termínu" = konec už uplynul a akce je stále rozpracovaná. */
export function poTerminu(z: StavovaZakazka, ref = today()): boolean {
  return z.konecAktualni < ref && (z.stav === "AKTIVNI" || z.stav === "POZASTAVENO");
}

/** Popisek pro zobrazení včetně odvozeného "po termínu". */
export function stavLabel(z: StavovaZakazka): string {
  if (poTerminu(z)) return "Po termínu";
  return ZAKAZKA_STAV_LABELS[z.stav];
}

// Světlé pilulky fungují i na tmavém pozadí (stejně jako badge Poptávek).
const STAV_BARVA: Record<StavZakazky, string> = {
  AKTIVNI: "bg-sky-100 text-sky-700",
  POZASTAVENO: "bg-amber-100 text-amber-800",
  DOKONCENO: "bg-emerald-100 text-emerald-700",
  ARCHIV: "bg-slate-100 text-slate-500",
};

export function stavBarva(z: StavovaZakazka): string {
  if (poTerminu(z)) return "bg-red-100 text-red-700";
  return STAV_BARVA[z.stav];
}
