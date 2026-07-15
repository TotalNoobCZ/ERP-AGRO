"use client";
// ----------------------------------------------------------------------------
//  Formuláře zákazníka: vytvoření, úprava a správa kontaktních osob
//  (1:1 z Popt-vky: customer-create-form, customer-form, contacts-manager).
// ----------------------------------------------------------------------------
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui";
import { COUNTRIES, dialForCountry } from "@/lib/countries";
import { formatPhone } from "@/lib/countries";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addContact,
  updateContact,
  deleteContact,
  type ContactRowLite,
} from "@/app/(erp)/zakaznici/actions";

// ---------- Vytvoření zákazníka ----------
export function CustomerCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function onCountryChange(value: string) {
    setCountry(value);
    const dial = dialForCountry(value);
    if (dial && !phone.trim()) setPhone(dial + " ");
  }

  async function save() {
    if (!name.trim()) { setError("Název / jméno je povinné."); return; }
    setSaving(true); setError("");
    const res = await createCustomer({ name, email, phone, address, country });
    if (res.ok && res.data) {
      router.push(`/zakaznici/${res.data.id}`);
      router.refresh();
    } else {
      setError(!res.ok ? res.error : "Uložení se nezdařilo.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Název / jméno *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="country">Stát</Label>
          <Select id="country" value={country} onChange={(e) => onCountryChange(e.target.value)}>
            <option value="">— nevyplněno —</option>
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>{c.name}{c.dial ? ` (${c.dial})` : ""}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="address">Adresa</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Ukládám…" : "Vytvořit zákazníka"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/zakaznici")}>Zpět</Button>
      </div>
    </div>
  );
}

// ---------- Úprava zákazníka ----------
type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
};

export function CustomerForm({ customer, inquiryCount }: { customer: Customer; inquiryCount: number }) {
  const router = useRouter();
  const [name, setName] = useState(customer.name ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [country, setCountry] = useState(customer.country ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function onCountryChange(value: string) {
    setCountry(value);
    const dial = dialForCountry(value);
    if (dial && !phone.trim()) setPhone(dial + " ");
  }

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    const res = await updateCustomer(customer.id, { name, email, phone, address, country });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else setError(res.error);
    setSaving(false);
  }

  async function remove() {
    if (!confirm("Opravdu smazat tohoto zákazníka?")) return;
    setSaving(true); setError("");
    const res = await deleteCustomer(customer.id);
    if (res.ok) {
      router.push("/zakaznici");
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Název / jméno *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="country">Stát</Label>
          <Select id="country" value={country} onChange={(e) => onCountryChange(e.target.value)}>
            <option value="">— nevyplněno —</option>
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>{c.name}{c.dial ? ` (${c.dial})` : ""}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="address">Adresa</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-500">Uloženo.</p>}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Ukládám…" : "Uložit změny"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/zakaznici")}>Zpět</Button>
        </div>
        <Button variant="ghost" onClick={remove} disabled={saving} title="Smazat zákazníka"
          className="text-destructive hover:bg-destructive/10">
          Smazat
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {inquiryCount > 0
          ? `Na tomto zákazníkovi visí ${inquiryCount} poptávek. Smazat ho půjde, až u něj nebudou žádné.`
          : "Na tomto zákazníkovi nevisí žádné poptávky."}
      </p>
    </div>
  );
}

// ---------- Správa kontaktních osob ----------
export function ContactsManager({ customerId, initial }: { customerId: string; initial: ContactRowLite[] }) {
  const [contacts, setContacts] = useState<ContactRowLite[]>(initial);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setForm({ name: "", phone: "", email: "" });
    setAdding(false);
    setEditingId(null);
    setError("");
  }

  async function add() {
    if (!form.name.trim()) { setError("Jméno je povinné."); return; }
    setBusy(true); setError("");
    const res = await addContact(customerId, form);
    setBusy(false);
    if (res.ok && res.data) {
      setContacts((cs) => [...cs, res.data!.contact]);
      resetForm();
    } else setError(!res.ok ? res.error : "Uložení se nezdařilo.");
  }

  async function saveEdit(id: string) {
    if (!form.name.trim()) { setError("Jméno je povinné."); return; }
    setBusy(true); setError("");
    const res = await updateContact(id, form);
    setBusy(false);
    if (res.ok) {
      setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...form } : c)));
      resetForm();
    } else setError(res.error);
  }

  async function remove(id: string) {
    if (!confirm("Smazat tento kontakt?")) return;
    setBusy(true);
    const res = await deleteContact(id);
    setBusy(false);
    if (res.ok) setContacts((cs) => cs.filter((c) => c.id !== id));
  }

  function startEdit(c: ContactRowLite) {
    setEditingId(c.id);
    setAdding(false);
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "" });
    setError("");
  }

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Zatím žádné kontaktní osoby.</p>
      )}

      <div className="space-y-2">
        {contacts.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input placeholder="Jméno *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <div className="flex gap-1">
                <Button size="sm" onClick={() => saveEdit(c.id)} disabled={busy}>✓</Button>
                <Button size="sm" variant="outline" onClick={resetForm} disabled={busy}>✕</Button>
              </div>
            </div>
          ) : (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{c.name}</span>
                {c.phone && <span className="text-muted-foreground"> · {formatPhone(c.phone)}</span>}
                {c.email && <span className="text-muted-foreground"> · {c.email}</span>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(c)} title="Upravit">✏️</Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => remove(c.id)} title="Smazat">🗑</Button>
              </div>
            </div>
          ),
        )}
      </div>

      {adding && (
        <div className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input placeholder="Jméno *" value={form.name} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="flex gap-1">
            <Button size="sm" onClick={add} disabled={busy}>✓</Button>
            <Button size="sm" variant="outline" onClick={resetForm} disabled={busy}>✕</Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!adding && editingId === null && (
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setForm({ name: "", phone: "", email: "" }); }}>
          + Přidat kontakt
        </Button>
      )}
    </div>
  );
}
