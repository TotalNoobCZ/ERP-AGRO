// Archiv akcí – port z Planovani/app/(app)/archiv/page.tsx.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { StavBadge } from "@/components/zakazky/common";
import type { StavZakazky } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function ArchivPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("zakazky")
    .select("id, kod, misto_plneni, konec_aktualni, stav, archivovano_kdy, prirazeni:prirazeni_zakazka(count)")
    .is("deleted_at", null)
    .eq("stav", "ARCHIV")
    .order("archivovano_kdy", { ascending: false });

  const zakazky = (data ?? []) as unknown as {
    id: string;
    kod: string;
    misto_plneni: string;
    konec_aktualni: string;
    stav: StavZakazky;
    archivovano_kdy: string | null;
    prirazeni: { count: number }[];
  }[];

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Archiv</h1>
      <p className="mb-4 text-sm text-text-muted">Archivované akce. Otevřením akce ji můžeš znovu aktivovat.</p>

      {zakazky.length === 0 ? (
        <p className="text-sm text-text-muted">Archiv je prázdný.</p>
      ) : (
        <div className="card divide-y divide-line">
          {zakazky.map((z) => (
            <Link key={z.id} href={`/zakazky/${z.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-accent">
              <span className="font-mono text-sm font-semibold">{z.kod}</span>
              <span className="flex-1 truncate text-sm text-text-muted">{z.misto_plneni}</span>
              <span className="hidden text-xs text-text-muted sm:inline">{z.prirazeni?.[0]?.count ?? 0} os.</span>
              <span className="text-sm text-text-muted">
                {z.archivovano_kdy ? `archiv. ${formatCz(new Date(z.archivovano_kdy))}` : ""}
              </span>
              <StavBadge z={{ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
