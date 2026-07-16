// Tabule poptávek – drag & drop přiřazení odpovědné osobě (jako Konstrukce).
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryPoptavkyBoard } from "@/lib/poptavky-query";
import PoptavkyBoard from "@/components/poptavky/PoptavkyBoard";
import { canWrite, type Role } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function PoptavkyTabulePage() {
  const supabase = await createClient();
  const [{ osoby, poptavky }, profile] = await Promise.all([
    queryPoptavkyBoard(supabase),
    getCurrentProfile(),
  ]);
  const editable = profile ? canWrite(profile.role as Role) : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tabule poptávek</h1>
        <span className="text-sm text-text-muted">
          {editable ? "Přetáhni poptávku na osobu = přiřazení" : "Jen ke čtení"}
        </span>
      </div>
      <PoptavkyBoard osoby={osoby} poptavky={poptavky} editable={editable} />
    </div>
  );
}
