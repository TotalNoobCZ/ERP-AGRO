"use client";
// Seznam zákazníků s okamžitým vyhledáváním (název, e-mail, telefon, stát).
import { useMemo, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { formatPhone } from "@/lib/countries";

export type ZakaznikRadek = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  inquiryCount: number;
};

export function ZakazniciTabulka({ rows }: { rows: ZakaznikRadek[] }) {
  const [dotaz, setDotaz] = useState("");
  const q = dotaz.trim().toLowerCase();

  const filtrovane = useMemo(() => {
    if (!q) return rows;
    return rows.filter((c) =>
      [c.name, c.email, c.phone, c.country]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [rows, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <span className="absolute left-2.5 top-2 text-text-muted">🔍</span>
          <input
            className="field pl-8"
            placeholder="Hledat zákazníka (název, e-mail, telefon, stát)…"
            value={dotaz}
            onChange={(e) => setDotaz(e.target.value)}
          />
        </div>
        {q && <button type="button" className="btn-ghost" onClick={() => setDotaz("")}>✕ Zrušit</button>}
        <span className="ml-auto text-sm text-text-muted">
          {q ? `${filtrovane.length} z ${rows.length}` : `${rows.length} záznamů`}
        </span>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Název</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Stát</TableHead>
              <TableHead className="text-center">Poptávek</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrovane.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {q ? "Žádný zákazník neodpovídá hledání." : "Zatím žádní zákazníci."}
                </TableCell>
              </TableRow>
            )}
            {filtrovane.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/zakaznici/${c.id}`} className="hover:underline">{c.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.email ? <span className="flex items-center gap-1.5">✉️ {c.email}</span> : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.phone ? <span className="flex items-center gap-1.5">📞 {formatPhone(c.phone)}</span> : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.country ? <span className="flex items-center gap-1.5">🌍 {c.country}</span> : "—"}
                </TableCell>
                <TableCell className="text-center">{c.inquiryCount}</TableCell>
                <TableCell>
                  <Link href={`/zakaznici/${c.id}`} className="text-muted-foreground hover:text-text" title="Upravit">
                    ✏️
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
