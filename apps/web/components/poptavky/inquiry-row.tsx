"use client";
// Řádek tabulky poptávek – klikací celý. Termín lze upravit přímo z řádku,
// kontaktní údaje jsou v odsazeném bloku (ne nalepené na řádek).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { StatusBadge, DeadlineBadge } from "./badges";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/countries";
import { nastavitTerminPoptavky } from "@/app/(erp)/poptavky/actions";
import type { InquiryStatus } from "@erp/core";

export type InquiryRowData = {
  id: string;
  number: number;
  subject: string;
  customerName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  personName: string;
  receivedAt: string;
  status: InquiryStatus;
  deadline: string | null;
  needsContact: boolean;
};

/** Buňka termínu s inline editací (bez otvírání detailu poptávky). */
function TerminCell({ id, deadline }: { id: string; deadline: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(deadline ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function uloz(novy: string | null) {
    setBusy(true);
    setErr(null);
    const res = await nastavitTerminPoptavky(id, novy);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5" onClick={stop}>
        <DeadlineBadge deadline={deadline} />
        <button
          type="button"
          onClick={() => {
            setVal(deadline ?? "");
            setErr(null);
            setEditing(true);
          }}
          data-tip={deadline ? "Změnit termín" : "Přidat termín"}
          aria-label="Upravit termín"
          className="text-text-muted transition hover:text-link"
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1" onClick={stop}>
      <DateField value={val} onChange={setVal} className="w-36" />
      <button
        type="button"
        disabled={busy || !val}
        onClick={() => uloz(val)}
        data-tip="Uložit termín"
        aria-label="Uložit"
        className="rounded-md border border-line px-1.5 py-1 text-green-600 hover:bg-accent disabled:opacity-40"
      >
        ✓
      </button>
      {deadline && (
        <button
          type="button"
          disabled={busy}
          onClick={() => uloz(null)}
          data-tip="Zrušit termín"
          aria-label="Zrušit termín"
          className="rounded-md border border-line px-1.5 py-1 text-text-muted hover:bg-accent"
        >
          🗑
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Zavřít"
        className="rounded-md border border-line px-1.5 py-1 text-text-muted hover:bg-accent"
      >
        ✕
      </button>
      {err && <span className="err w-full">{err}</span>}
    </span>
  );
}

export function InquiryRow({ inq }: { inq: InquiryRowData }) {
  const router = useRouter();
  const open = () => router.push(`/poptavky/${inq.id}`);
  const hasContact = Boolean(inq.contactName || inq.contactPhone || inq.contactEmail);
  return (
    <>
      <TableRow className={`cursor-pointer hover:bg-accent ${hasContact ? "border-0" : ""}`} onClick={open}>
        <TableCell className="text-muted-foreground">#{inq.number}</TableCell>
        <TableCell className="font-medium">{inq.subject}</TableCell>
        <TableCell>{inq.customerName}</TableCell>
        <TableCell>{inq.personName}</TableCell>
        <TableCell className="whitespace-nowrap">{formatDate(inq.receivedAt)}</TableCell>
        <TableCell><StatusBadge status={inq.status} /></TableCell>
        <TableCell><TerminCell id={inq.id} deadline={inq.deadline} /></TableCell>
        <TableCell>
          {inq.needsContact && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              📞 Kontaktovat
            </span>
          )}
        </TableCell>
      </TableRow>

      {/* Podřádek s kontaktní osobou – odsazený blok, ať není nalepený na řádek. */}
      {hasContact && (
        <TableRow className="cursor-pointer hover:bg-accent" onClick={open}>
          <TableCell />
          <TableCell colSpan={7} className="pb-3 pt-0">
            <span className="ml-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-line pl-3 text-xs text-muted-foreground">
              {inq.contactName && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                  👤 {inq.contactName}
                </span>
              )}
              {inq.contactPhone && (
                <a
                  href={`tel:${inq.contactPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 hover:text-text hover:underline"
                >
                  📞 {formatPhone(inq.contactPhone)}
                </a>
              )}
              {inq.contactEmail && (
                <a
                  href={`mailto:${inq.contactEmail}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 hover:text-text hover:underline"
                >
                  ✉️ {inq.contactEmail}
                </a>
              )}
            </span>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
