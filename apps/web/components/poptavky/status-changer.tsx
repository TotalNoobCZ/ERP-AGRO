"use client";
// Změna stavu poptávky + přepínač "Kontaktovat" + komentáře + smazání
// (1:1 z Popt-vky: status-changer, contact-toggle, comment-form,
// delete-inquiry-button – fetch nahrazen server actions).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea, Select } from "@/components/ui";
import { INQUIRY_STATUS_ORDER, INQUIRY_STATUS_LABELS, type InquiryStatus } from "@erp/core";
import {
  changeInquiryStatus,
  setNeedsContact,
  clearNeedsContact,
  addComment,
  deleteInquiry,
} from "@/app/(erp)/poptavky/actions";

type Person = { id: string; name: string };

export function StatusChanger({
  inquiryId,
  current,
  persons,
  defaultAuthor,
}: {
  inquiryId: string;
  current: InquiryStatus;
  persons: Person[];
  defaultAuthor: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<InquiryStatus>(current);
  const [author, setAuthor] = useState(defaultAuthor || persons[0]?.name || "");
  const [saving, setSaving] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function doSave(note?: string) {
    setSaving(true);
    setError("");
    const res = await changeInquiryStatus(inquiryId, status, author, note);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShowReason(false);
    setReason("");
    // Tok mezi moduly: poptávka OBJEDNANO → nabídnout založení zakázky.
    if (status === "OBJEDNANO" && current !== "OBJEDNANO") {
      if (window.confirm("Poptávka je objednaná. Vytvořit z ní rovnou výrobní zakázku?")) {
        router.push(`/zakazky/nova?inquiry=${inquiryId}`);
        return;
      }
    }
    router.refresh();
  }

  function save() {
    if (status === current) return;
    if (status === "ZAMITNUTO") {
      setShowReason(true);
      return;
    }
    doSave();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Změnit stav</label>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as InquiryStatus)}>
          {INQUIRY_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Kdo</label>
        <Select className="w-auto" value={author} onChange={(e) => setAuthor(e.target.value)}>
          {persons.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </Select>
      </div>
      <Button size="sm" onClick={save} disabled={saving || status === current}>
        {saving ? "Ukládám…" : "Uložit stav"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}

      {/* Vyskakovací okno pro důvod zamítnutí */}
      {showReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border bg-surface p-4 shadow-lg">
            <h3 className="mb-1 font-medium">Důvod zamítnutí</h3>
            <p className="mb-2 text-sm text-muted-foreground">
              Uveďte důvod – uloží se k historii stavů.
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Např. Cena mimo rozpočet, vybrali konkurenci…"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowReason(false); setReason(""); setStatus(current); }}
                disabled={saving}
              >
                Zrušit
              </Button>
              <Button size="sm" onClick={() => doSave(reason.trim())} disabled={saving || !reason.trim()}>
                {saving ? "Ukládám…" : "Zamítnout"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ContactToggle({ inquiryId, initial }: { inquiryId: string; initial: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function setTrue() {
    setLoading(true); setError("");
    const res = await setNeedsContact(inquiryId);
    setLoading(false);
    if (res.ok) { setChecked(true); router.refresh(); }
    else setError(res.error);
  }

  async function submitResult() {
    if (!result.trim()) { setError("Zadejte výsledek hovoru."); return; }
    setLoading(true); setError("");
    const res = await clearNeedsContact(inquiryId, result);
    setLoading(false);
    if (res.ok) {
      setChecked(false); setShowForm(false); setResult("");
      router.refresh();
    } else setError(res.error);
  }

  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) setTrue();
    else setShowForm(true); // odškrtnutí vyžaduje výsledek hovoru
  }

  return (
    <div className="rounded-lg border p-3">
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="h-4 w-4" checked={checked} onChange={onToggle} disabled={loading} />
        <span>📞</span>
        <span className="font-medium">Kontaktovat</span>
        {checked && <span className="text-xs text-orange-500">(vyžaduje zpětný kontakt)</span>}
      </label>

      {showForm && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Pro odškrtnutí zadejte výsledek hovoru (uloží se do poznámek):
          </p>
          <Textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="Např. Domluveno na příští týden, pošlou podklady…"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={submitResult} disabled={loading || !result.trim()}>
              {loading ? "Ukládám…" : "Uložit a odškrtnout"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setResult(""); setError(""); }}>
              Zrušit
            </Button>
          </div>
        </div>
      )}
      {!showForm && error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function CommentForm({
  inquiryId,
  persons,
  defaultAuthor,
}: {
  inquiryId: string;
  persons: Person[];
  defaultAuthor: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [author, setAuthor] = useState(defaultAuthor || persons[0]?.name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    if (!text.trim()) return;
    setSaving(true); setError("");
    const res = await addComment(inquiryId, text, author);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    setText("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Textarea placeholder="Napsat poznámku…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <Select className="w-auto" value={author} onChange={(e) => setAuthor(e.target.value)}>
          {persons.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </Select>
        <Button size="sm" onClick={add} disabled={saving || !text.trim()}>
          {saving ? "Ukládám…" : "Přidat poznámku"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function DeleteInquiryButton({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!confirm("Opravdu smazat tuto poptávku? Akce je nevratná.")) return;
    setDeleting(true);
    const res = await deleteInquiry(inquiryId);
    if (!res.ok) { setError(res.error); setDeleting(false); return; }
    router.push("/poptavky");
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="destructive" size="sm" onClick={remove} disabled={deleting}>
        🗑 {deleting ? "Mažu…" : "Smazat"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
