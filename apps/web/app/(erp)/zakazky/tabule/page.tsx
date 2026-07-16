// Tabule zakázek – obrácené drag & drop: osoby (vlevo) se táhnou na zakázky (vpravo).
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryZakazkyBoard } from "@/lib/zakazky-query";
import ZakazkyBoard from "@/components/zakazky/ZakazkyBoard";
import { canWrite, type Role } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function ZakazkyTabulePage() {
  const supabase = await createClient();
  const [{ osoby, zakazky }, profile] = await Promise.all([
    queryZakazkyBoard(supabase),
    getCurrentProfile(),
  ]);
  const editable = profile ? canWrite(profile.role as Role) : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tabule zakázek</h1>
        <span className="text-sm text-text-muted">
          {editable ? "Přetáhni osobu na zakázku = přiřazení pracovníka" : "Jen ke čtení"}
        </span>
      </div>
      <ZakazkyBoard osoby={osoby} zakazky={zakazky} editable={editable} />
    </div>
  );
}
