"use client";
// Admin: nastavit uživateli konkrétní heslo, nebo mu vygenerovat nové.
import { useState } from "react";
import { nastavitHesloUzivateli } from "@/app/(erp)/sprava/heslo-actions";

export function HesloSprava({
  profileId,
  maUcet,
  maEmail,
  jmeno,
}: {
  profileId: string;
  maUcet: boolean;
  maEmail: boolean;
  jmeno: string;
}) {
  const [heslo, setHeslo] = useState("");
  const [busy, setBusy] = useState<"set" | "gen" | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  // Vygenerované heslo k předání uživateli.
  const [vysledek, setVysledek] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState(false);
  // Potvrzení po nastavení vlastního (nezobrazovaného) hesla.
  const [potvrzeni, setPotvrzeni] = useState(false);

  async function nastavit() {
    setChyba(null);
    setVysledek(null);
    setPotvrzeni(false);
    setBusy("set");
    const res = await nastavitHesloUzivateli(profileId, heslo);
    setBusy(null);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setHeslo("");
    // Vlastní zadané heslo nezobrazujeme (admin ho zná), jen potvrdíme.
    setPotvrzeni(true);
  }

  async function generovat() {
    setChyba(null);
    setPotvrzeni(false);
    setBusy("gen");
    const res = await nastavitHesloUzivateli(profileId, null);
    setBusy(null);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setVysledek(res.heslo ?? null);
    setZkopirovano(false);
  }

  async function kopirovat() {
    if (!vysledek) return;
    try {
      await navigator.clipboard.writeText(vysledek);
      setZkopirovano(true);
    } catch {
      // Schránka nemusí být dostupná – heslo je stejně vidět.
    }
  }

  // Bez e-mailu se uživatel nepřihlašuje (typicky dílna) → heslo nedává smysl.
  if (!maEmail) {
    return (
      <div className="card max-w-2xl space-y-2 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Heslo uživatele
        </h2>
        <p className="text-xs text-text-muted">
          Tento uživatel nemá e-mail, do systému se nepřihlašuje (slouží jen pro
          přiřazování na zakázky/úkoly). Chceš-li mu přístup zřídit, doplň v profilu
          e-mail a ulož.
        </p>
      </div>
    );
  }

  return (
    <div className="card max-w-2xl space-y-4 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        Heslo uživatele
      </h2>
      <p className="text-xs text-text-muted">
        {maUcet
          ? "Uživatel už má účet. Můžeš mu nastavit nové heslo, nebo vygenerovat náhodné a předat mu ho. Po přihlášení si ho může sám změnit."
          : "Uživatel zatím nemá heslo. Nastavením nebo vygenerováním hesla mu rovnou založíš přístup (alternativa k „Jsem tu poprvé“)."}
      </p>

      {/* Nastavit konkrétní heslo */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="label">Nové heslo (min. 8 znaků)</label>
          <input
            type="text"
            className="field"
            value={heslo}
            onChange={(e) => {
              setHeslo(e.target.value);
              setPotvrzeni(false);
            }}
            placeholder="zadej heslo…"
            autoComplete="off"
          />
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={nastavit}
          disabled={busy !== null || heslo.length < 8}
        >
          {busy === "set" ? "Ukládám…" : "Nastavit heslo"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-text-muted">nebo</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* Vygenerovat náhodné heslo */}
      <button
        className="btn-ghost"
        type="button"
        onClick={generovat}
        disabled={busy !== null}
      >
        {busy === "gen" ? "Generuji…" : "Vygenerovat nové heslo"}
      </button>

      {vysledek && (
        <div className="space-y-2 rounded-md border border-line bg-bg p-3">
          <p className="text-xs text-text-muted">
            Nové heslo pro <strong>{jmeno}</strong> – předej mu ho osobně.
            Po přihlášení si ho může změnit ve Správě.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all rounded bg-surface px-3 py-2 font-mono text-base tracking-wider">
              {vysledek}
            </code>
            <button className="btn-ghost" type="button" onClick={kopirovat}>
              {zkopirovano ? "Zkopírováno ✓" : "Kopírovat"}
            </button>
          </div>
        </div>
      )}

      {potvrzeni && (
        <p className="text-sm text-green-500">
          Heslo nastaveno. Předej ho uživateli – po přihlášení si ho může změnit.
        </p>
      )}
      {chyba && <p className="err">{chyba}</p>}
    </div>
  );
}
