"use client";
// Množina klíčů (např. sbalené skupiny) trvale uložená v localStorage –
// přežije přechod mezi kartami i obnovení stránky.
import { useCallback, useEffect, useRef, useState } from "react";

export function usePersistentSet(key: string): {
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  set: Set<string>;
} {
  const [set, setSet] = useState<Set<string>>(new Set());
  const nactenoRef = useRef(false);

  // Načtení z localStorage po připojení (na serveru není dostupné).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSet(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* localStorage nemusí být dostupné */
    }
    nactenoRef.current = true;
  }, [key]);

  // Uložení při každé změně (až po prvním načtení, ať nepřepíšeme uloženou hodnotu).
  useEffect(() => {
    if (!nactenoRef.current) return;
    try {
      localStorage.setItem(key, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }, [key, set]);

  const toggle = useCallback((id: string) => {
    setSet((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  return { has: (id) => set.has(id), toggle, set };
}
