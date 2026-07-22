// Seznam akcí (zakázek) s živými filtry – jednotné s Poptávkami.
import { Suspense } from "react";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { jenPrirazeneProProfil } from "@/lib/pristup";
import { queryZakazky, type ZakazkaListParams, type ZakazkaListRow } from "@/lib/zakazky-query";
import { nacistLidiZakazek, sjednotitOsoby } from "@/lib/zakazky/lide";
import { ZakazkyFilters, ZakazkyFilterRestore } from "@/components/zakazky/filters";
import { ZakazkySeznam } from "@/components/zakazky/ZakazkySeznam";

export const dynamic = "force-dynamic";

export default async function ZakazkyPage({
  searchParams,
}: {
  searchParams: Promise<ZakazkaListParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const omezeni = jenPrirazeneProProfil(profile) ? profile!.id : null;
  const zakazky = await queryZakazky(supabase, params, omezeni);

  // Podzakázky vnořené pod hlavní akci (rozbalovací seznam).
  const ids = new Set(zakazky.map((z) => z.id));
  const detiMap = new Map<string, ZakazkaListRow[]>();
  for (const z of zakazky) {
    if (z.parent_id && ids.has(z.parent_id)) {
      if (!detiMap.has(z.parent_id)) detiMap.set(z.parent_id, []);
      detiMap.get(z.parent_id)!.push(z);
    }
  }
  const lidiMap = await nacistLidiZakazek(supabase, zakazky.map((z) => z.id));
  const uzly = zakazky
    .filter((z) => !z.parent_id || !ids.has(z.parent_id))
    .map((row) => {
      const deti = (detiMap.get(row.id) ?? []).map((d) => ({ row: d, lide: lidiMap.get(d.id) ?? [] }));
      const lideAkce = sjednotitOsoby([lidiMap.get(row.id), ...deti.map((d) => d.lide)]);
      return { row, deti, lideAkce };
    });

  return (
    <div>
      <ZakazkyFilterRestore />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Akce</h1>
        <span className="text-sm text-text-muted">{zakazky.length} záznamů</span>
      </div>

      <Suspense fallback={<div className="mb-4 h-10" />}>
        <ZakazkyFilters />
      </Suspense>

      <p className="mb-2 text-xs text-text-muted">P1 = nejvyšší priorita · P5 = nejnižší</p>

      {zakazky.length === 0 ? (
        <p className="text-sm text-text-muted">Žádné akce neodpovídají filtru.</p>
      ) : (
        <ZakazkySeznam uzly={uzly} />
      )}
    </div>
  );
}
