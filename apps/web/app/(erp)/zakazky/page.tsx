// Seznam akcí (zakázek) s živými filtry – jednotné s Poptávkami.
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { queryZakazky, type ZakazkaListParams, type ZakazkaListRow } from "@/lib/zakazky-query";
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
  const zakazky = await queryZakazky(supabase, params);

  // Podzakázky vnořené pod hlavní akci (rozbalovací seznam).
  const ids = new Set(zakazky.map((z) => z.id));
  const detiMap = new Map<string, ZakazkaListRow[]>();
  for (const z of zakazky) {
    if (z.parent_id && ids.has(z.parent_id)) {
      if (!detiMap.has(z.parent_id)) detiMap.set(z.parent_id, []);
      detiMap.get(z.parent_id)!.push(z);
    }
  }
  const uzly = zakazky
    .filter((z) => !z.parent_id || !ids.has(z.parent_id))
    .map((row) => ({ row, deti: detiMap.get(row.id) ?? [] }));

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
