// Správa uživatelů – jen pro administrátory (ostatní přesměrováni na /heslo).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, ODDELENI, ODDELENI_LABELS, isAdmin, type Oddeleni, type Role } from "@erp/core";
import { userColor } from "@erp/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SpravaPage({
  searchParams,
}: {
  searchParams: Promise<{ odd?: string }>;
}) {
  const profile = await getCurrentProfile();
  const role = (profile?.role ?? "viewer") as Role;

  // Správa je jen pro administrátory; ostatní na změnu vlastního hesla.
  if (!isAdmin(role)) {
    redirect("/heslo");
  }

  const sp = await searchParams;
  const aktivniOdd = ODDELENI.includes(sp.odd as Oddeleni) ? (sp.odd as Oddeleni) : null;

  // E-mail je citlivý sloupec (odebraný roli authenticated) → čteme přes
  // service-role klienta. Stránka je jen pro adminy (výše redirect).
  const supabase = createAdminClient();
  let dotaz = supabase
    .from("profiles")
    .select("id, name, email, role, oddeleni, assignable, color_index, active, auth_user_id")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (aktivniOdd) dotaz = dotaz.eq("oddeleni", aktivniOdd);
  const { data: profily } = await dotaz;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Správa uživatelů</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/sprava/prava"
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:border-link hover:text-link"
          >
            🔐 Přístupová práva
          </Link>
          <Link
            href="/sprava/novy"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            + Nový uživatel
          </Link>
        </div>
      </div>

      {/* Filtr dle oddělení */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-medium text-text-muted">Oddělení:</span>
        <Link
          href="/sprava"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            aktivniOdd === null
              ? "bg-primary text-primary-foreground"
              : "border border-line text-text-muted hover:border-link hover:text-link"
          }`}
        >
          Vše
        </Link>
        {ODDELENI.map((o) => (
          <Link
            key={o}
            href={`/sprava?odd=${o}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              aktivniOdd === o
                ? "bg-primary text-primary-foreground"
                : "border border-line text-text-muted hover:border-link hover:text-link"
            }`}
          >
            {ODDELENI_LABELS[o]}
          </Link>
        ))}
      </div>

      <p className="text-sm text-text-muted">
        {aktivniOdd
          ? `${(profily ?? []).length} uživatelů v oddělení ${ODDELENI_LABELS[aktivniOdd]}`
          : `${(profily ?? []).length} uživatelů celkem`}
      </p>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Oddělení</TableHead>
              <TableHead>Účet</TableHead>
              <TableHead>Stav</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(profily ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span
                    className="inline-block h-4 w-4 rounded-full"
                    style={{ backgroundColor: userColor(p.color_index) }}
                    title={`Barva ${p.color_index ?? "—"}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/sprava/${p.id}`} className="hover:underline">{p.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                <TableCell>{ROLE_LABELS[p.role as Role]}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.oddeleni ? ODDELENI_LABELS[p.oddeleni as Oddeleni] : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {!p.email ? "nepřihlašuje se" : p.auth_user_id ? "má heslo" : "bez hesla"}
                </TableCell>
                <TableCell>
                  {p.active ? (
                    <span className="badge bg-emerald-100 text-emerald-700">aktivní</span>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-500">neaktivní</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
