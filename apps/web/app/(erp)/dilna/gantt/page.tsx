// Dílna – Gantt: výrobní fáze (Pálení a příprava / Svařování / Lakovna / Montáž)
// jako pruhy v čase, zakázky k akci vnořené pod akci.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { okno } from "@/lib/zakazky/timeline";
import Timeline, { type TRadek, type TBar } from "@/components/zakazky/Timeline";
import { queryDilnaZakazky, seskupitDoAkci, type DilnaZakazka } from "@/lib/dilna-query";
import { DILNA_FAZE, DILNA_FAZE_LABELS, DILNA_FAZE_BARVY } from "@erp/core";

export const dynamic = "force-dynamic";

function refDatum(ref?: string): Date {
  const n = new Date();
  if (ref && /^\d{4}-\d{2}$/.test(ref)) {
    const [y, m] = ref.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, 1));
  }
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
}

function refPosun(d: Date, o: number): string {
  const p = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + o, 1));
  return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Pruhy fází zakázky (jen fáze, které mají aspoň jedno datum). */
function fazoveBary(z: DilnaZakazka): TBar[] {
  const bary: TBar[] = [];
  let lane = 0;
  for (const t of DILNA_FAZE) {
    const f = z.faze[t];
    if (!f || (!f.datumOd && !f.datumDo)) continue;
    const od = parseDay(f.datumOd ?? f.datumDo!);
    const doo = parseDay(f.datumDo ?? f.datumOd!);
    bary.push({
      od,
      do: doo,
      lane,
      barva: DILNA_FAZE_BARVY[t],
      label: DILNA_FAZE_LABELS[t],
      titulek: `${z.kod} · ${DILNA_FAZE_LABELS[t]}: ${formatCz(od)} – ${formatCz(doo)}`,
    });
    lane++;
  }
  return bary;
}

function naRadek(z: DilnaZakazka): TRadek {
  const bary = fazoveBary(z);
  return {
    id: z.id,
    label: z.kod,
    sublabel: z.popis || z.mistoPlneni,
    href: `/zakazky/${z.id}`,
    pocetRad: Math.max(1, bary.length),
    bary,
    znacky: [],
  };
}

export default async function DilnaGanttPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const sp = await searchParams;
  const ref = refDatum(sp.ref);
  const { start, konec } = okno(ref, 3);
  const supabase = await createClient();
  const zakazky = await queryDilnaZakazky(supabase);
  const skupiny = seskupitDoAkci(zakazky);

  const radky: TRadek[] = skupiny.map(({ akce, deti }) => {
    const r = naRadek(akce);
    if (deti.length > 0) r.podradky = deti.map(naRadek);
    return r;
  });

  const refStr = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dílna – Gantt výrobních fází</h1>
        <div className="flex items-center gap-2">
          <Link href={`/dilna/gantt?ref=${refPosun(ref, -1)}`} className="btn-ghost">◀</Link>
          <Link href={`/dilna/gantt?ref=${refPosun(ref, 1)}`} className="btn-ghost">▶</Link>
        </div>
      </div>

      <Timeline start={start} konec={konec} radky={radky} prazdno="Žádné naplánované fáze v tomto období." />

      <div className="flex flex-wrap gap-4 text-xs text-text-muted">
        {DILNA_FAZE.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: DILNA_FAZE_BARVY[t] }} />
            {DILNA_FAZE_LABELS[t]}
          </span>
        ))}
      </div>
    </div>
  );
}
