// Dílna – Tabule: stejné obrácené drag & drop jako u Zakázek, ale vlevo jen
// lidé z dílen (výroba / montáž / elektro). Přiřazení se propisuje do Zakázek.
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryZakazkyBoard } from "@/lib/zakazky-query";
import ZakazkyBoard from "@/components/zakazky/ZakazkyBoard";
import { canWrite, muzeOdebratKonstruktera, jeDilna, type Role } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function DilnaTabulePage() {
  const supabase = await createClient();
  const [{ osoby, zakazky }, profile] = await Promise.all([
    queryZakazkyBoard(supabase),
    getCurrentProfile(),
  ]);
  // Jen lidé z dílen (výroba / montáž / elektro).
  const dilnaOsoby = osoby.filter((o) => jeDilna(o.oddeleni));
  const editable = profile ? canWrite(profile.role as Role) : false;
  const smiOdebratKonstruktera = profile
    ? muzeOdebratKonstruktera({ role: profile.role, sefkonstrukter: profile.sefkonstrukter })
    : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dílna – tabule</h1>
        <span className="text-sm text-text-muted">
          {editable ? "Přetáhni pracovníka z dílen na zakázku" : "Jen ke čtení"}
        </span>
      </div>
      <ZakazkyBoard
        osoby={dilnaOsoby}
        zakazky={zakazky}
        editable={editable}
        muzeOdebratKonstruktera={smiOdebratKonstruktera}
        zakazkaBasePath="/dilna"
      />
    </div>
  );
}
