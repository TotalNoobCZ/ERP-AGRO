"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "first-time";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();

      if (mode === "first-time") {
        if (password !== passwordAgain) {
          setError("Hesla se neshodují.");
          return;
        }
        const res = await fetch("/api/auth/first-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "Nastavení hesla selhalo.");
          return;
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        setError("Nesprávný e-mail nebo heslo.");
        return;
      }
      // TODO(remember): vypnuté „Zapamatovat přihlášení" = session jen do
      // zavření prohlížeče – doladí se nastavením cookie lifetime.
      void remember;
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-border/30 bg-surface p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold">ERP AGRO</h1>
        <p className="mb-6 text-sm text-text-muted">
          Poptávky · Zakázky · Konstrukce
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-text-muted">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border/40 bg-bg px-3 py-2 outline-none focus:border-user-0"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-text-muted">
              {mode === "login" ? "Heslo" : "Nové heslo (min. 8 znaků)"}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={mode === "first-time" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border/40 bg-bg px-3 py-2 outline-none focus:border-user-0"
            />
          </div>

          {mode === "first-time" && (
            <div>
              <label htmlFor="passwordAgain" className="mb-1 block text-sm text-text-muted">
                Nové heslo znovu
              </label>
              <input
                id="passwordAgain"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordAgain}
                onChange={(e) => setPasswordAgain(e.target.value)}
                className="w-full rounded-md border border-border/40 bg-bg px-3 py-2 outline-none focus:border-user-0"
              />
            </div>
          )}

          {mode === "login" && (
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Zapamatovat přihlášení
            </label>
          )}

          {error && <p className="text-sm text-user-7">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-user-0 px-3 py-2 font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Pracuji…" : mode === "login" ? "Přihlásit se" : "Nastavit heslo a přihlásit"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "first-time" : "login");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-text-muted underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Jsem tu poprvé" : "Zpět na přihlášení"}
        </button>
      </div>
    </main>
  );
}
