// Modul Dílna – seznam zakázek (vč. podzakázek) s editací výrobních fází
// (Pálení a příprava / Svařování / Lakovna / Montáž) a uskladnění.
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryDilnaZakazky, seskupitDoAkci } from "@/lib/dilna-query";
import { DilnaZakazkaEditor } from "@/components/dilna/DilnaZakazkaEditor";
import { canWrite, type Role } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function DilnaPage() {
  const supabase = await createClient();
  const [zakazky, profile] = await Promise.all([queryDilnaZakazky(supabase), getCurrentProfile()]);
  const editable = profile ? canWrite(profile.role as Role) : false;
  const skupiny = seskupitDoAkci(zakazky);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dílna – zakázky</h1>
        <span className="text-sm text-text-muted">{zakazky.length} zakázek</span>
      </div>
      <p className="text-sm text-text-muted">
        Zadej termíny výrobních fází a místo uskladnění. Lidé se přiřazují na Tabuli, přehled v čase je na Ganttu.
        Termíny i uskladnění se propisují k zakázce.
      </p>

      {skupiny.length === 0 ? (
        <p className="text-sm text-text-muted">Žádné aktivní zakázky.</p>
      ) : (
        <div className="space-y-4">
          {skupiny.map(({ akce, deti }) => (
            <div key={akce.id} className="space-y-2">
              <DilnaZakazkaEditor zakazka={akce} editable={editable} />
              {deti.length > 0 && (
                <div className="ml-4 space-y-2 border-l-2 border-link/30 pl-4">
                  {deti.map((d) => (
                    <DilnaZakazkaEditor key={d.id} zakazka={d} editable={editable} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
