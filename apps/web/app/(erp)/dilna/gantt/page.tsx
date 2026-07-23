// Dílna – Gantt. Dva režimy:
//  • „Podle fází" (výchozí): výrobní fáze zakázek jako pruhy, podzakázky pod akcí.
//  • „Podle zaměstnance": lidé z dílen a jejich přiřazení na zakázky v čase.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { okno, baleniDoRad } from "@/lib/zakazky/timeline";
import { poTerminu } from "@/lib/zakazky/orders";
import Timeline, { type TRadek, type TBar } from "@/components/zakazky/Timeline";
import { queryDilnaZakazky, seskupitDoAkci, type DilnaZakazka } from "@/lib/dilna-query";
import { DILNA_FAZE, DILNA_FAZE_LABELS, DILNA_FAZE_BARVY, ODDELENI_LABELS, jeDilna, type Oddeleni, type StavZakazky } from "@erp/core";

export const dynamic = "force-dynamic";

const BARVA_POTERMINU = "#b91c1c";
const PALETA_AKCE = [
  "#2f5d78", "#0f766e", "#b45309", "#6d28d9", "#be185d", "#4d7c0f",
  "#0369a1", "#a16207", "#9d174d", "#166534", "#7c2d12", "#1e40af",
  "#9a3412", "#155e75", "#5b21b6", "#065f46",
];
function barvaProAkci(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETA_AKCE[h % PALETA_AKCE.length]!;
}

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

const BARVA_TERMIN = "#64748b"; // slate-500 – termín zakázky/akce (základní pruh)

/** Rozsah termínů podzakázek: nejdřívější začátek → nejzazší konec (nebo null). */
function rozsahPodzakazek(deti: DilnaZakazka[]): { od: Date; do: Date } | null {
  if (deti.length === 0) return null;
  let od = parseDay(deti[0]!.zacatek);
  let doo = parseDay(deti[0]!.konecAktualni);
  for (const d of deti) {
    const z = parseDay(d.zacatek);
    const k = parseDay(d.konecAktualni);
    if (z < od) od = z;
    if (k > doo) doo = k;
  }
  return { od, do: doo };
}

function naRadek(z: DilnaZakazka, terminOverride?: { od: Date; do: Date } | null): TRadek {
  // Základní pruh = termín zakázky/akce. U akce s podzakázkami se odvodí z jejich
  // rozsahu (nejdřívější začátek → nejzazší konec), jinak vlastní začátek → konec.
  const zac = terminOverride ? terminOverride.od : parseDay(z.zacatek);
  const kon = terminOverride ? terminOverride.do : parseDay(z.konecAktualni);
  const termin: TBar = {
    od: zac,
    do: kon,
    lane: 0,
    barva: BARVA_TERMIN,
    label: z.kod,
    titulek: terminOverride
      ? `${z.kod} – termín dle podzakázek: ${formatCz(zac)} – ${formatCz(kon)}`
      : `${z.kod} – termín: ${formatCz(zac)} – ${formatCz(kon)}`,
  };
  const faze = fazoveBary(z).map((b) => ({ ...b, lane: b.lane + 1 }));
  const bary = [termin, ...faze];
  return {
    id: z.id,
    label: z.kod,
    sublabel: z.popis || z.mistoPlneni,
    href: `/dilna/${z.id}`,
    pocetRad: 1 + faze.length,
    bary,
    znacky: [],
  };
}

export default async function DilnaGanttPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const mode = sp.mode === "osoby" ? "osoby" : "faze";
  const ref = refDatum(sp.ref);
  const { start, konec } = okno(ref, 3);
  const supabase = await createClient();

  let radky: TRadek[] = [];

  if (mode === "faze") {
    const zakazky = await queryDilnaZakazky(supabase);
    const skupiny = seskupitDoAkci(zakazky);
    // Hlavní akce (s propsaným termínem) je vždy vidět; podzakázky jsou
    // rozbalitelné podřádky – poslední stav (co uživatel naposledy rozbalil)
    // si Timeline pamatuje v localStorage pod vlastním klíčem.
    radky = skupiny.map(({ akce, deti }) => ({
      // Pruh hlavní akce = rozsah jejích podzakázek (má-li nějaké), jinak vlastní termín.
      ...naRadek(akce, rozsahPodzakazek(deti)),
      podradky: deti.map((d) => ({ ...naRadek(d), label: `↳ ${d.kod}` })),
    }));
  } else {
    // Podle zaměstnance: přiřazení lidí z dílen na zakázky v okně.
    const { data } = await supabase
      .from("prirazeni_zakazka")
      .select(
        `osoba_id, datum_od, datum_do,
         osoba:profiles!inner(name, oddeleni, active),
         zakazka:zakazky!inner(id, kod, misto_plneni, konec_aktualni, stav, deleted_at)`,
      )
      .is("deleted_at", null)
      .is("zakazka.deleted_at", null)
      .lte("datum_od", konec.toISOString().slice(0, 10))
      .gte("datum_do", start.toISOString().slice(0, 10));

    const prirazeni = (data ?? []) as unknown as {
      osoba_id: string;
      datum_od: string;
      datum_do: string;
      osoba: { name: string; oddeleni: string | null; active: boolean };
      zakazka: { id: string; kod: string; misto_plneni: string; konec_aktualni: string; stav: StavZakazky };
    }[];

    const podleOsoby = new Map<string, typeof prirazeni>();
    for (const p of prirazeni) {
      if (!p.osoba.active || !jeDilna(p.osoba.oddeleni)) continue; // jen lidé z dílen
      if (!podleOsoby.has(p.osoba_id)) podleOsoby.set(p.osoba_id, []);
      podleOsoby.get(p.osoba_id)!.push(p);
    }

    radky = Array.from(podleOsoby.entries())
      .sort((a, b) => a[1][0]!.osoba.name.localeCompare(b[1][0]!.osoba.name, "cs"))
      .map(([osobaId, ps]) => {
        const { prvky, pocetRad } = baleniDoRad(
          ps.map((p) => ({ od: parseDay(p.datum_od), do: parseDay(p.datum_do), p })),
        );
        const os = ps[0]!.osoba;
        return {
          id: osobaId,
          label: os.name,
          sublabel: os.oddeleni ? (ODDELENI_LABELS[os.oddeleni as Oddeleni] ?? os.oddeleni) : undefined,
          pocetRad,
          bary: prvky.map((x) => ({
            od: x.od,
            do: x.do,
            lane: x.lane,
            barva: poTerminu({ konecAktualni: parseDay(x.p.zakazka.konec_aktualni), stav: x.p.zakazka.stav })
              ? BARVA_POTERMINU
              : barvaProAkci(x.p.zakazka.id),
            label: x.p.zakazka.kod,
            href: `/dilna/${x.p.zakazka.id}`,
            titulek: `${x.p.zakazka.kod} — ${x.p.zakazka.misto_plneni}`,
          })),
          znacky: [],
        };
      });
  }

  const refStr = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
  const odkaz = (m: string, r: string) => `/dilna/gantt?mode=${m}&ref=${r}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          <Link href={odkaz("faze", refStr)} className={`btn-ghost ${mode === "faze" ? "border-link text-link" : "border-transparent"}`}>
            Podle fází
          </Link>
          <Link href={odkaz("osoby", refStr)} className={`btn-ghost ${mode === "osoby" ? "border-link text-link" : "border-transparent"}`}>
            Podle zaměstnance
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href={odkaz(mode, refPosun(ref, -1))} className="btn-ghost">◀</Link>
          <Link href={odkaz(mode, refPosun(ref, 1))} className="btn-ghost">▶</Link>
        </div>
      </div>

      <Timeline
        start={start}
        konec={konec}
        radky={radky}
        persistKey="erp_dilna_gantt_otevrene"
        prazdno={mode === "osoby" ? "Nikdo z dílen nemá v tomto období přiřazení." : "Žádné naplánované fáze v tomto období."}
      />

      <div className="flex flex-wrap gap-4 text-xs text-text-muted">
        {mode === "faze" ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: BARVA_TERMIN }} />
              Termín zakázky/akce
            </span>
            {DILNA_FAZE.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: DILNA_FAZE_BARVY[t] }} />
                {DILNA_FAZE_LABELS[t]}
              </span>
            ))}
          </>
        ) : (
          <>
            <span>Barvy odlišují jednotlivé akce.</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: BARVA_POTERMINU }} />
              Po termínu
            </span>
          </>
        )}
      </div>
    </div>
  );
}
