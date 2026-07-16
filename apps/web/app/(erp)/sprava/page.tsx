// Správa uživatelů: admin vidí seznam profilů + zakládání;
// ostatní jen změnu vlastního hesla (dle zadání Konstrukce).
import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { ROLE_LABELS, ODDELENI_LABELS, isAdmin, type Oddeleni, type Role } from "@erp/core";
import { userColor } from "@erp/ui";
import { ZmenaHesla } from "@/components/sprava/ProfilForm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SpravaPage() {
  const profile = await getCurrentProfile();
  const role = (profile?.role ?? "viewer") as Role;

  if (!isAdmin(role)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Správa</h1>
        <ZmenaHesla />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: profily } = await supabase
    .from("profiles")
    .select("id, name, email, role, oddeleni, assignable, color_index, active, auth_user_id")
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Správa uživatelů</h1>
        <Link
          href="/sprava/novy"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          + Nový uživatel
        </Link>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Oddělení</TableHead>
              <TableHead>Přiřaditelný</TableHead>
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
                <TableCell>{p.assignable ? "✓" : "—"}</TableCell>
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

      <ZmenaHesla />
    </div>
  );
}
