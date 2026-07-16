"use client";
// ----------------------------------------------------------------------------
//  Formulář poptávky – sdílený pro VYTVOŘENÍ i EDITACI
//  (1:1 z Popt-vky/components/inquiry-form.tsx, fetch → server actions).
//  Autor u nové poptávky se přednastavuje na přihlášeného uživatele
//  (v originále byl natvrdo "MELŠOVÁ Petra").
// ----------------------------------------------------------------------------
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Label, Card, CardContent, Select } from "@/components/ui";
import { COUNTRIES, dialForCountry } from "@/lib/countries";
import { DateField } from "@/components/DateField";
import { createInquiry, updateInquiry, type InquiryInput } from "@/app/(erp)/poptavky/actions";

type Customer = {
  id: string;
  name: string;
  contacts?: { id: string; name: string; phone: string | null; email: string | null }[];
};
type Person = { id: string; name: string };

type InitialValues = {
  id?: string;
  subject?: string;
  description?: string | null;
  source?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  customerId?: string;
  personId?: string;
  deadline?: string; // YYYY-MM-DD
  receivedAt?: string; // YYYY-MM-DD
};

const SOURCE_OPTIONS = ["Mail", "Telefon", "Přímé oslovení"];

export function InquiryForm({
  customers,
  persons,
  authors,
  initial,
  defaultAuthor,
}: {
  customers: Customer[];
  persons: Person[]; // odpovědná osoba = vedoucí / Projekťák
  authors?: Person[]; // autor (pro historii) = kdokoli aktivní; fallback na persons
  initial?: InitialValues;
  defaultAuthor: string;
}) {
  const authorList = authors ?? persons;
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [personId, setPersonId] = useState(initial?.personId ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [receivedAt, setReceivedAt] = useState(initial?.receivedAt ?? today());

  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    initial?.customerId ? "existing" : customers.length > 0 ? "existing" : "new",
  );
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", address: "", country: "" });

  function onNewCustomerCountry(value: string) {
    const dial = dialForCountry(value);
    setNewCustomer((c) => ({
      ...c,
      country: value,
      phone: dial && !c.phone.trim() ? dial + " " : c.phone,
    }));
  }

  const [author, setAuthor] = useState(defaultAuthor || authorList[0]?.name || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedCustomer = customers.find((x) => x.id === customerId);

  function selectContact(contactId: string) {
    setSelectedContactId(contactId);
    const ct = selectedCustomer?.contacts?.find((c) => c.id === contactId);
    if (ct) {
      setContactName(ct.name);
      setContactPhone(ct.phone ?? "");
      setContactEmail(ct.email ?? "");
    }
  }

  function onCustomerSelect(id: string) {
    setCustomerId(id);
    setSelectedContactId("");
    const c = customers.find((x) => x.id === id);
    const cs = c?.contacts ?? [];
    const first = cs[0];
    if (cs.length === 1 && first) {
      setSelectedContactId(first.id);
      setContactName(first.name);
      setContactPhone(first.phone ?? "");
      setContactEmail(first.email ?? "");
    } else {
      setContactName(""); setContactPhone(""); setContactEmail("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload: InquiryInput = {
      subject,
      description: description ?? undefined,
      source: source ?? undefined,
      contactName: contactName ?? undefined,
      contactPhone: contactPhone ?? undefined,
      contactEmail: contactEmail ?? undefined,
      personId,
      deadline,
      receivedAt,
      author,
    };
    if (customerMode === "existing") payload.customerId = customerId;
    else payload.newCustomer = newCustomer;

    const res = isEdit ? await updateInquiry(initial!.id!, payload) : await createInquiry(payload);

    if (res.ok) {
      const id = isEdit ? initial!.id : res.id;
      router.push(`/poptavky/${id}`);
      router.refresh();
    } else {
      setError(res.error || "Uložení se nezdařilo.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label htmlFor="subject">Předmět *</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="description">Popis</Label>
            <Textarea id="description" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="source">Druh poptávky</Label>
            <Select id="source" value={source ?? ""} onChange={(e) => setSource(e.target.value)}>
              <option value="">— nevyplněno —</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>

          {/* Kontaktní osoba – u existujícího zákazníka jen jeho kontakty */}
          {customerMode === "existing" && selectedCustomer && (selectedCustomer.contacts?.length ?? 0) > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="contactPick">Kontaktní osoba</Label>
                <Select id="contactPick" value={selectedContactId} onChange={(e) => selectContact(e.target.value)}>
                  <option value="">— zadat ručně —</option>
                  {selectedCustomer.contacts!.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </Select>
                {!selectedContactId && (
                  <Input
                    className="mt-2"
                    placeholder="Jméno kontaktu"
                    value={contactName ?? ""}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                )}
              </div>
              <div>
                <Label htmlFor="contactPhone">Telefon kontaktu</Label>
                <Input id="contactPhone" value={contactPhone ?? ""} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contactEmail">E-mail kontaktu</Label>
                <Input id="contactEmail" value={contactEmail ?? ""} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="contactName">Kontaktní osoba</Label>
                <Input id="contactName" value={contactName ?? ""} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contactPhone">Telefon kontaktu</Label>
                <Input id="contactPhone" value={contactPhone ?? ""} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contactEmail">E-mail kontaktu</Label>
                <Input id="contactEmail" value={contactEmail ?? ""} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="receivedAt">Datum přijetí</Label>
              <DateField id="receivedAt" value={receivedAt} onChange={setReceivedAt} />
            </div>
            <div>
              <Label htmlFor="deadline">Termín nabídky</Label>
              <DateField id="deadline" value={deadline} onChange={setDeadline} />
            </div>
          </div>

          <div>
            <Label htmlFor="person">Odpovědná osoba</Label>
            <Select id="person" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">— nepřiřazeno —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-text-muted">
              Nepovinné – můžeš doplnit později přetažením na Tabuli poptávek.
              Vybrat lze jen roli „Vedoucí" nebo oddělení „Projekťák".
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Zákazník */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <Label className="mb-0">Zákazník *</Label>
            <div className="flex gap-1 text-sm">
              <button type="button" onClick={() => setCustomerMode("existing")} className={tab(customerMode === "existing")}>
                Existující
              </button>
              <button type="button" onClick={() => setCustomerMode("new")} className={tab(customerMode === "new")}>
                Nový
              </button>
            </div>
          </div>

          {customerMode === "existing" ? (
            <Select value={customerId} onChange={(e) => onCustomerSelect(e.target.value)} required>
              <option value="">— vyberte zákazníka —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Název / jméno *" value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
              <Input placeholder="E-mail" value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
              <Select className="w-full" value={newCustomer.country} onChange={(e) => onNewCustomerCountry(e.target.value)}>
                <option value="">Stát…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}{c.dial ? ` (${c.dial})` : ""}</option>
                ))}
              </Select>
              <Input placeholder="Telefon" value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
              <Input placeholder="Adresa" value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Autor (pro historii) – jen u nové poptávky */}
      {!isEdit && (
        <Card>
          <CardContent className="pt-6">
            <Label htmlFor="author">Zakládá (pro historii)</Label>
            <Select id="author" value={author} onChange={(e) => setAuthor(e.target.value)}>
              {authorList.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </Select>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit poptávku"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Zrušit
        </Button>
      </div>
    </form>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function tab(active: boolean): string {
  return `rounded-md px-2.5 py-1 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`;
}
