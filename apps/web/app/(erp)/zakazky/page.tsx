// Seznam akcí (zakázek) s živými filtry – jednotné s Poptávkami.
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { queryZakazky, type ZakazkaListParams } from "@/lib/zakazky-query";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { StavBadge } from "@/components/zakazky/common";
import { ZakazkyFilters, ZakazkyFilterRestore } from "@/components/zakazky/filters";

export const dynamic = "force-dynamic";

export default async function ZakazkyPage({
  searchParams,
}: {
  searchParams: Promise<ZakazkaListParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const zakazky = await queryZakazky(supabase, params);

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
        <div className="card divide-y divide-line">
          {zakazky.map((z) => (
            <Link key={z.id} href={`/zakazky/${z.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-accent">
              <span title="Priorita (1 = nejvyšší, 5 = nejnižší)" className="w-8 text-center text-xs font-semibold text-text-muted">
                P{z.priorita}
              </span>
              <span className="font-mono text-sm font-semibold">{z.kod}</span>
              <span className="flex-1 truncate text-sm text-text-muted">{z.misto_plneni}</span>
              {z.inquiry_id && (
                <span title="Vznikla z poptávky" className="hidden text-xs text-link sm:inline">z poptávky</span>
              )}
              <span className="hidden text-xs text-text-muted sm:inline">{z.prirazeni?.[0]?.count ?? 0} os.</span>
              <span className="text-sm text-text-muted">{formatCz(parseDay(z.konec_aktualni))}</span>
              <StavBadge z={{ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
