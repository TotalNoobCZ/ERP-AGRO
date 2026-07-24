"use client";
// Paměť volby rozsahu přehledu poptávek (Moje / Vše). Poslední volbu si
// pamatuje prohlížeč; při otevření bez parametru ji obnoví.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const KEY = "poptavky_prehled_vse";

export function PrehledScope({ explicit, vse }: { explicit: boolean; vse: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (explicit) {
      // Uživatel vybral přepínačem → zapamatuj.
      try {
        localStorage.setItem(KEY, vse ? "1" : "0");
      } catch {
        /* localStorage nemusí být dostupné */
      }
      return;
    }
    // Otevřeno bez parametru → obnov poslední volbu (výchozí = moje).
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* ignore */
    }
    if (saved === "1") router.replace("/poptavky/dashboard?vse=1");
  }, [explicit, vse, router]);
  return null;
}
