"use client";
// Formulář profilu (Správa) + změna vlastního hesla.
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ROLES, ROLE_LABELS, ODDELENI, ODDELENI_LABELS } from "@erp/core";
import { USER_PALETTE, USER_PALETTE_NAMES } from "@erp/ui";
import type { ProfilStav } from "@/app/(erp)/sprava/actions";

type Init = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  oddeleni?: string | null;
  assignable?: boolean;
  colorIndex?: number | null;
  active?: boolean;
  pozice?: string | null;
  osobniCislo?: string | null;
  poznamka?: string | null;
  maUcet?: boolean;
};

function Btn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" type="submit" disabled={pending}>
      {pending ? "Ukládám…" : label}
    </button>
  );
}

export function ProfilForm({
  akce,
  initial,
}: {
  akce: (prev: ProfilStav, fd: FormData) => Promise<ProfilStav>;
  initial?: Init;
}) {
  const router = useRouter();
  const [stav, formAction] = useActionState<ProfilStav, FormData>(
    async (prev, fd) => {
      const res = await akce(prev, fd);
      if (res.ok) {
        router.push("/sprava");
        router.refresh();
      }
      return res;
    },
    {},
  );
  const ch = stav.chyby ?? {};
  const isEdit = Boolean(initial?.id);

  return (
    <form action={formAction} className="card max-w-2xl space-y-4 p-6">
      {stav.obecna && <p className="err">{stav.obecna}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Jméno a příjmení</label>
          <input name="name" className="field" defaultValue={initial?.name ?? ""} required />
          {ch.name && <p className="err">{ch.name}</p>}
        </div>
        <div>
          <label className="label">E-mail (slouží k přihlášení)</label>
          <input name="email" type="email" className="field" defaultValue={initial?.email ?? ""} required />
          {ch.email && <p className="err">{ch.email}</p>}
          {isEdit && initial?.maUcet && (
            <p className="mt-1 text-xs text-text-muted">Uživatel už má nastavené heslo.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Role</label>
          <select name="role" className="field" defaultValue={initial?.role ?? "viewer"}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Oddělení</label>
          <select name="oddeleni" className="field" defaultValue={initial?.oddeleni ?? ""}>
            <option value="">—</option>
            {ODDELENI.map((o) => (
              <option key={o} value={o}>{ODDELENI_LABELS[o]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Barva (dlaždice)</label>
          <select name="colorIndex" className="field" defaultValue={String(initial?.colorIndex ?? 0)}>
            {USER_PALETTE.map((hex, i) => (
              <option key={hex} value={i}>{USER_PALETTE_NAMES[i]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="assignable" defaultChecked={initial?.assignable ?? false} />
          Lze přiřazovat (řešitel / pracovník / dlaždice)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} />
          Aktivní
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Pozice (nepovinné)</label>
          <input name="pozice" className="field" defaultValue={initial?.pozice ?? ""} />
        </div>
        <div>
          <label className="label">Osobní číslo (nepovinné)</label>
          <input name="osobniCislo" className="field" defaultValue={initial?.osobniCislo ?? ""} />
        </div>
      </div>

      <div>
        <label className="label">Poznámka</label>
        <textarea name="poznamka" className="field" rows={2} defaultValue={initial?.poznamka ?? ""} />
      </div>

      <div className="flex gap-3 pt-2">
        <Btn label={isEdit ? "Uložit změny" : "Založit profil"} />
        <Link href="/sprava" className="btn-ghost">Zrušit</Link>
      </div>

      {!isEdit && (
        <p className="text-xs text-text-muted">
          Profil se založí bez hesla. Uživatel si ho nastaví sám na přihlašovací stránce
          přes „Jsem tu poprvé“ (odkaz na aplikaci mu pošli ručně).
        </p>
      )}
    </form>
  );
}

/** Změna vlastního hesla (pro všechny role, viewer nic jiného ve Správě nemá). */
export function ZmenaHesla() {
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password.length < 8) {
      setMsg({ ok: false, text: "Heslo musí mít alespoň 8 znaků." });
      return;
    }
    if (password !== passwordAgain) {
      setMsg({ ok: false, text: "Hesla se neshodují." });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMsg({ ok: false, text: "Změna hesla se nezdařila." });
    else {
      setMsg({ ok: true, text: "Heslo změněno." });
      setPassword("");
      setPasswordAgain("");
    }
  }

  return (
    <form onSubmit={change} className="card max-w-md space-y-3 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Změna vlastního hesla</h2>
      <div>
        <label className="label">Nové heslo (min. 8 znaků)</label>
        <input type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      <div>
        <label className="label">Nové heslo znovu</label>
        <input type="password" className="field" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)} autoComplete="new-password" />
      </div>
      {msg && <p className={msg.ok ? "text-sm text-green-500" : "err"}>{msg.text}</p>}
      <button className="btn-primary" type="submit" disabled={busy || !password}>
        {busy ? "Ukládám…" : "Změnit heslo"}
      </button>
    </form>
  );
}
