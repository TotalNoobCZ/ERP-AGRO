"use client";
// Přepínání tmavého/světlého vzhledu. Volba se ukládá do localStorage
// a aplikuje atributem data-theme na <html>; výchozí je tmavý vzhled.
import { useEffect, useState } from "react";

const KEY = "erp_theme";
export type Theme = "dark" | "light";

/** Inline skript do <head> – nastaví téma před vykreslením (žádné probliknutí). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Přepnout na světlý vzhled" : "Přepnout na tmavý vzhled"}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-sm hover:bg-accent ${className}`}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
