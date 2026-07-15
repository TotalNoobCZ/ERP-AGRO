"use client";
// Drobné sdílené komponenty modulu Zakázky
// (port StavBadge, SubmitButton, SmazatButton, OsobaSelect z Planovani).
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ODDELENI_LABELS, type Oddeleni, type StavZakazky } from "@erp/core";
import { stavLabel, stavBarva } from "@/lib/zakazky/orders";

export function StavBadge({ z }: { z: { konecAktualni: Date; stav: StavZakazky } }) {
  return <span className={`badge ${stavBarva(z)}`}>{stavLabel(z)}</span>;
}

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Ukládám…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function SmazatButton({
  akce,
  label = "Smazat akci",
  confirmText = "Opravdu smazat tuto akci? Zmizí ze seznamů i z plánu (zůstane jen v auditu).",
}: {
  akce: (fd: FormData) => Promise<void>;
  label?: string;
  confirmText?: string;
}) {
  return (
    <form
      action={akce}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <SubmitButton className="btn-danger" pendingText="Mažu…">{label}</SubmitButton>
    </form>
  );
}

export type OsobaLite = { id: string; name: string; oddeleni: string | null };

function oddeleniLabel(o: string | null): string {
  if (!o) return "";
  return ODDELENI_LABELS[o as Oddeleni] ?? o;
}

/** Našeptávač osob (port OsobaSelect – jméno je jednotné pole `name`). */
export function OsobaSelect({
  osoby,
  value,
  onChange,
  name = "prir_osobaId",
}: {
  osoby: OsobaLite[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const vybrany = osoby.find((o) => o.id === value);
  const popisek = vybrany ? vybrany.name : "";

  const nalezene = useMemo(() => {
    const s = q.trim().toLowerCase();
    const zaklad = s ? osoby.filter((o) => o.name.toLowerCase().includes(s)) : osoby;
    return zaklad.slice(0, 50);
  }, [q, osoby]);

  return (
    <div className="relative flex-1">
      <input type="hidden" name={name} value={value} />
      <input
        className="field"
        placeholder="Hledat osobu…"
        value={open ? q : popisek}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
          {nalezene.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">Nic nenalezeno</li>}
          {nalezene.map((o) => (
            <li
              key={o.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.id);
                setQ("");
                setOpen(false);
              }}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${o.id === value ? "bg-accent font-medium" : ""}`}
            >
              {o.name} <span className="text-xs text-text-muted">{oddeleniLabel(o.oddeleni)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
