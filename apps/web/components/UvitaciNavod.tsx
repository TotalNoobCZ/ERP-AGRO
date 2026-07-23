"use client";
// Uvítací okénko po prvním přihlášení: nabídne otevření návodu. Že už ho
// uživatel viděl, se pamatuje v prohlížeči (klíč podle jeho ID), takže se
// příště neukáže. Ano → otevře manuál, Ne → zůstane na hlavní obrazovce.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function UvitaciNavod({ userId, jmeno }: { userId: string; jmeno?: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const key = `erp_uvod_viden_${userId}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(key) !== "1") setShow(true);
    } catch {
      /* localStorage nemusí být dostupné */
    }
  }, [key]);

  function zapamatuj() {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }

  if (!show) return null;

  function otevritNavod() {
    zapamatuj();
    setShow(false);
    router.push("/napoveda");
  }

  function preskocit() {
    zapamatuj();
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="text-4xl">👋</div>
        <h2 className="mt-2 text-lg font-bold">Vítej{jmeno ? `, ${jmeno}` : ""}!</h2>
        <p className="mt-2 text-sm text-text-muted">
          Chceš si nejdřív projít krátký návod k systému? Najdeš v něm, jak fungují
          Poptávky, Zakázky, Konstrukce, Dílna i fakturace.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" className="btn-primary" onClick={otevritNavod}>
            📖 Ano, otevřít návod
          </button>
          <button type="button" className="btn-ghost" onClick={preskocit}>
            Teď ne, na hlavní obrazovku
          </button>
        </div>
        <p className="mt-3 text-xs text-text-muted">Návod si kdykoli otevřeš přes ⓘ v hlavičce.</p>
      </div>
    </div>
  );
}
