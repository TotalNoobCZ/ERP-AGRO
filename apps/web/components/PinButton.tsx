"use client";
// Přišpendlení záložky jako výchozí pro daný modul. Uloženo v prohlížeči
// (localStorage) → po kliknutí na hlavní kartu se otevře přišpendlená záložka.
import { useEffect, useState } from "react";

const EVENT = "erp-pin-change";

export function pinKey(modul: string): string {
  return `erp_pin_${modul}`;
}

export function PinButton({ modul, href }: { modul: string; href: string }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setPinned(localStorage.getItem(pinKey(modul)) === href);
      } catch {
        /* localStorage nemusí být dostupné */
      }
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, [modul, href]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const key = pinKey(modul);
      if (localStorage.getItem(key) === href) localStorage.removeItem(key);
      else localStorage.setItem(key, href);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      data-tip={pinned ? "Zrušit výchozí záložku" : "Přišpendlit jako výchozí záložku modulu (otevře se první)"}
      data-tip-pos="bottom"
      aria-label="Přišpendlit záložku"
      className={`ml-0.5 text-xs leading-none transition ${pinned ? "opacity-100" : "opacity-25 hover:opacity-70"}`}
    >
      📌
    </button>
  );
}
