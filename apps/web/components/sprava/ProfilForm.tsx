"use client";
// Formulář profilu (Správa) + změna vlastního hesla.
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ROLES, ROLE_LABELS, ODDELENI, ODDELENI_LABELS, KAPITOLY, KAPITOLA_LABELS, ODDELENI_KAPITOLA, jeDilna, MODULY, MODUL_LABELS } from "@erp/core";
import { USER_PALETTE, USER_PALETTE_NAMES, ODDELENI_BARVA } from "@erp/ui";

/** Odpovídá uložená barva výchozí barvě oddělení? (→ režim „dle oddělení") */
function jeBarvaOddeleni(oddeleni: string | null | undefined, colorHex: string | null | undefined): boolean {
  if (!oddeleni || !colorHex) return false;
  const auto = ODDELENI_BARVA[oddeleni];
  return !!auto && auto.toLowerCase() === colorHex.toLowerCase();
}
import type { ProfilStav } from "@/app/(erp)/sprava/actions";

type Init = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  oddeleni?: string | null;
  assignable?: boolean;
  sefkonstrukter?: boolean;
  accessModules?: string[] | null;
  colorIndex?: number | null;
  colorHex?: string | null;
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

  // Řízená pole – aby se po neúspěšném uložení (React 19 resetuje formulář se
  // server akcí) zadané údaje nesmazaly.
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState(initial?.role ?? "viewer");
  const [oddeleni, setOddeleni] = useState(initial?.oddeleni ?? "");
  const [colorIndex, setColorIndex] = useState(String(initial?.colorIndex ?? 0));
  // Barva: režim „dle oddělení" (výchozí u nové karty) barvu odvozuje z mapy
  // ODDELENI_BARVA a při změně oddělení se živě mění; ruční volba ho vypne.
  // U editace se pozná auto režim tak, že uložená barva odpovídá oddělení.
  const initHex = initial?.colorHex ?? USER_PALETTE[initial?.colorIndex ?? 0] ?? USER_PALETTE[0]!;
  const [barvaAuto, setBarvaAuto] = useState(
    !isEdit || jeBarvaOddeleni(initial?.oddeleni, initial?.colorHex),
  );
  const [rucniHex, setRucniHex] = useState(initHex);
  const colorHex = barvaAuto ? (ODDELENI_BARVA[oddeleni] ?? rucniHex) : rucniHex;
  const vlastniBarva = !barvaAuto && !USER_PALETTE.some((h) => h.toLowerCase() === colorHex.toLowerCase());
  // Klik na předvolbu vypne auto režim a drží v sync i colorIndex (kompatibilita).
  const vybratBarvu = (hex: string, idx: number) => {
    setBarvaAuto(false);
    setRucniHex(hex.toLowerCase());
    if (idx >= 0) setColorIndex(String(idx));
  };
  const [active, setActive] = useState(initial?.active ?? true);
  const [sefkonstrukter, setSefkonstrukter] = useState(initial?.sefkonstrukter ?? false);
  const [pozice, setPozice] = useState(initial?.pozice ?? "");
  const [osobniCislo, setOsobniCislo] = useState(initial?.osobniCislo ?? "");
  const [poznamka, setPoznamka] = useState(initial?.poznamka ?? "");
  const emailNepovinny = jeDilna(oddeleni);

  // Přístup k modulům: „dle oddělení" (accessModules = null) nebo „vlastní".
  const [accessMode, setAccessMode] = useState<"dle_oddeleni" | "vlastni">(
    initial?.accessModules != null ? "vlastni" : "dle_oddeleni",
  );
  const [accessModules, setAccessModules] = useState<string[]>(initial?.accessModules ?? []);
  const prepnoutModul = (m: string) =>
    setAccessModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  return (
    <form action={formAction} className="card max-w-2xl space-y-4 p-6">
      {stav.obecna && <p className="err">{stav.obecna}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Jméno a příjmení</label>
          <input name="name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          {ch.name && <p className="err">{ch.name}</p>}
        </div>
        <div>
          <label className="label">
            E-mail {emailNepovinny ? "(nepovinné)" : "(slouží k přihlášení)"}
          </label>
          <input
            name="email"
            type="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required={!emailNepovinny}
            placeholder={emailNepovinny ? "dílna se nepřihlašuje – lze nechat prázdné" : ""}
          />
          {ch.email && <p className="err">{ch.email}</p>}
          {emailNepovinny && (
            <p className="mt-1 text-xs text-text-muted">
              Bez e-mailu se uživatel nepřihlašuje – slouží jen pro přiřazování na zakázky/úkoly.
            </p>
          )}
          {isEdit && initial?.maUcet && (
            <p className="mt-1 text-xs text-text-muted">Uživatel už má nastavené heslo.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Role</label>
          <select name="role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Oddělení</label>
          <select
            name="oddeleni"
            className="field"
            value={oddeleni}
            onChange={(e) => setOddeleni(e.target.value)}
          >
            <option value="">—</option>
            {KAPITOLY.map((kap) => (
              <optgroup key={kap} label={KAPITOLA_LABELS[kap]}>
                {ODDELENI.filter((o) => ODDELENI_KAPITOLA[o] === kap).map((o) => (
                  <option key={o} value={o}>{ODDELENI_LABELS[o]}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Barva (dlaždice)</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Výchozí režim: barva se řídí oddělením (při jeho změně se sama přebarví). */}
            <button
              type="button"
              onClick={() => setBarvaAuto(true)}
              title="Barva se nastaví automaticky podle oddělení"
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs ${
                barvaAuto ? "border-text ring-2 ring-link" : "border-line hover:border-text"
              }`}
            >
              <span
                className="inline-block h-4 w-4 rounded-full border border-line"
                style={{ backgroundColor: ODDELENI_BARVA[oddeleni] ?? "#8A8F98" }}
              />
              Dle oddělení
            </button>
            {USER_PALETTE.map((hex, i) => (
              <button
                key={hex}
                type="button"
                onClick={() => vybratBarvu(hex, i)}
                title={USER_PALETTE_NAMES[i]}
                aria-label={USER_PALETTE_NAMES[i]}
                className={`h-7 w-7 rounded-full border transition ${
                  !barvaAuto && colorHex.toLowerCase() === hex.toLowerCase()
                    ? "border-text ring-2 ring-link"
                    : "border-line hover:border-text"
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
            {/* Vlastní RGB barva – nativní color picker */}
            <label
              className={`relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs ${
                vlastniBarva ? "border-text ring-2 ring-link" : "border-line hover:border-text"
              }`}
              title="Vlastní barva (RGB)"
            >
              <span className="inline-block h-4 w-4 rounded-full border border-line" style={{ backgroundColor: colorHex }} />
              Vlastní
              <input
                type="color"
                value={colorHex}
                onChange={(e) => vybratBarvu(e.target.value, USER_PALETTE.findIndex((h) => h.toLowerCase() === e.target.value.toLowerCase()))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          <input type="hidden" name="colorIndex" value={colorIndex} />
          <input type="hidden" name="colorHex" value={colorHex} />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktivní
        </label>
        {oddeleni === "konstrukce" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sefkonstrukter" checked={sefkonstrukter} onChange={(e) => setSefkonstrukter(e.target.checked)} />
            Šéfkonstruktér
            <span className="text-xs text-text-muted">(smí odebírat konstruktéry ze zakázek)</span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Pozice (nepovinné)</label>
          <input name="pozice" className="field" value={pozice} onChange={(e) => setPozice(e.target.value)} />
        </div>
        <div>
          <label className="label">Osobní číslo (nepovinné)</label>
          <input name="osobniCislo" className="field" value={osobniCislo} onChange={(e) => setOsobniCislo(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Poznámka</label>
        <textarea name="poznamka" className="field" rows={2} value={poznamka} onChange={(e) => setPoznamka(e.target.value)} />
      </div>

      {/* Přístup k modulům (kartám). „Dle oddělení" = zdědí plošné nastavení. */}
      <div className="rounded-lg border border-line p-4">
        <p className="mb-2 text-sm font-semibold">Přístup k modulům</p>
        <input type="hidden" name="access_mode" value={accessMode} />
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="access_mode_radio"
              checked={accessMode === "dle_oddeleni"}
              onChange={() => setAccessMode("dle_oddeleni")}
            />
            Podle oddělení (výchozí)
            <span className="text-xs text-text-muted">– řídí se plošným nastavením práv</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="access_mode_radio"
              checked={accessMode === "vlastni"}
              onChange={() => setAccessMode("vlastni")}
            />
            Vlastní nastavení
            <span className="text-xs text-text-muted">– přepíše nastavení oddělení</span>
          </label>
        </div>
        {accessMode === "vlastni" && (
          <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3">
            {MODULY.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="access_modules"
                  value={m}
                  checked={accessModules.includes(m)}
                  onChange={() => prepnoutModul(m)}
                />
                {MODUL_LABELS[m]}
              </label>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-text-muted">
          Správa je vždy jen pro administrátory. Uživatelé z Dílny (výroba/montáž/elektro)
          vidí v Zakázkách jen zakázky, ke kterým jsou přiřazeni.
        </p>
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
