"use client";
// Řádek tabulky poptávek – klikací celý (1:1 z Popt-vky/components/inquiry-row.tsx).
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui";
import { StatusBadge, DeadlineBadge } from "./badges";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/countries";
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
        <TableCell><DeadlineBadge deadline={inq.deadline} /></TableCell>
        <TableCell>
          {inq.needsContact && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              📞 Kontaktovat
            </span>
          )}
        </TableCell>
      </TableRow>

      {/* Podřádek s kontaktní osobou a jejími údaji. */}
      {hasContact && (
        <TableRow className="cursor-pointer hover:bg-accent" onClick={open}>
          <TableCell />
          <TableCell colSpan={7} className="pt-0 text-xs text-muted-foreground">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {inq.contactName && <span>👤 {inq.contactName}</span>}
              {inq.contactPhone && (
                <a
                  href={`tel:${inq.contactPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-text hover:underline"
                >
                  📞 {formatPhone(inq.contactPhone)}
                </a>
              )}
              {inq.contactEmail && (
                <a
                  href={`mailto:${inq.contactEmail}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-text hover:underline"
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
