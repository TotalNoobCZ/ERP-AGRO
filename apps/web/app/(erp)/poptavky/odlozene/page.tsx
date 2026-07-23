// Seznam odložených poptávek s datem připomenutí. Poptávky, u kterých už
// nastal čas připomenutí (remind_at <= dnes), jsou zvýrazněné.
import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryOdlozene } from "@/lib/poptavky-query";
import { canWrite, type Role } from "@erp/core";
import { formatDen } from "@/lib/format";
import { ObnovitButton } from "@/components/poptavky/obnovit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OdlozenePage() {
  const supabase = await createClient();
  const [odlozene, profile] = await Promise.all([queryOdlozene(supabase), getCurrentProfile()]);
  const writer = profile ? canWrite(profile.role as Role) : false;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Odložené poptávky</h1>
        <span className="text-sm text-muted-foreground">{odlozene.length} záznamů</span>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Předmět</TableHead>
              <TableHead>Zákazník</TableHead>
              <TableHead>Osoba</TableHead>
              <TableHead>Připomenout</TableHead>
              {writer && <TableHead className="w-28">Akce</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {odlozene.length === 0 && (
              <TableRow>
                <TableCell colSpan={writer ? 6 : 5} className="py-8 text-center text-muted-foreground">
                  Žádné odložené poptávky.
                </TableCell>
              </TableRow>
            )}
            {odlozene.map((inq) => {
              const due = inq.remind_at != null && inq.remind_at <= today;
              return (
                <TableRow key={inq.id} className={due ? "bg-amber-50" : undefined}>
                  <TableCell className="font-mono text-muted-foreground">{inq.number}</TableCell>
                  <TableCell>
                    <Link
                      href={`/poptavky/${inq.id}`}
                      className="font-medium hover:underline"
                      data-tip={inq.description || undefined}
                      data-tip-pos="bottom"
                    >
                      {inq.subject}
                    </Link>
                  </TableCell>
                  <TableCell>{inq.customer?.name ?? "—"}</TableCell>
                  <TableCell>{inq.person?.name ?? "—"}</TableCell>
                  <TableCell>
                    {inq.remind_at ? (
                      <span className={due ? "font-semibold text-amber-700" : undefined}>
                        {due && "⏰ "}
                        {formatDen(inq.remind_at)}
                        {due && " – čas kontaktovat"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">bez připomenutí</span>
                    )}
                  </TableCell>
                  {writer && (
                    <TableCell>
                      <ObnovitButton inquiryId={inq.id} author={profile?.name ?? ""} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
