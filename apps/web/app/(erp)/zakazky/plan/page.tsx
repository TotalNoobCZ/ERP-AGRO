// Plán (timeline) – port z Planovani/app/(app)/plan/page.tsx.
// Režimy: podle akcí (s rozbalitelnými pracovníky) / podle zaměstnance.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { poTerminu } from "@/lib/zakazky/orders";
import { okno, baleniDoRad } from "@/lib/zakazky/timeline";
import Timeline, { type TRadek } from "@/components/zakazky/Timeline";
import { MILNIK_LABELS, ODDELENI_LABELS, type Oddeleni, type StavZakazky, type TypMilniku } from "@erp/core";

export const dynamic = "force-dynamic";

const BARVA = {
  aktivni: "#2f5d78",
  potermin: "#b91c1c",
  pozastaveno: "#a16207",
  dokonceno: "#16a34a",
  vyroba: "#b45309",
  lakovani: "#6d28d9",
  puvodni: "#94a3b8",
};

const PALETA_PRAC = ["#2f5d78", "#b45309", "#0f766e", "#be185d", "#4d7c0f", "#6d28d9", "#0369a1", "#a16207"];

function barvaZakazky(z: { konecAktualni: Date; stav: StavZakazky }): string {
  if (poTerminu(z)) return BARVA.potermin;
  if (z.stav === "DOKONCENO") return BARVA.dokonceno;
  if (z.stav === "POZASTAVENO") return BARVA.pozastaveno;
  return BARVA.aktivni;
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

type ZakazkaRowT = {
  id: string;
  kod: string;
  misto_plneni: string;
  zacatek: string;
  konec_puvodni: string;
  konec_aktualni: string;
  stav: StavZakazky;
  milniky: { typ: string; datum: string; deleted_at: string | null }[];
  prirazeni: { osoba_id: string; datum_od: string; datum_do: string; deleted_at: string | null; osoba: { name: string } | null }[];
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; ref?: string }>;
}) {
  const sp = await searchParams;
  const mode = sp.mode === "osoby" ? "osoby" : "zakazky";
  const ref = refDatum(sp.ref);
  const { start, konec } = okno(ref, 3);
  const supabase = await createClient();

  let radky: TRadek[] = [];

  if (mode === "zakazky") {
    const { data } = await supabase
      .from("zakazky")
      .select(
        `id, kod, misto_plneni, zacatek, konec_puvodni, konec_aktualni, stav,
         milniky(typ, datum, deleted_at),
         prirazeni:prirazeni_zakazka(osoba_id, datum_od, datum_do, deleted_at, osoba:profiles(name))`,
      )
      .is("deleted_at", null)
      .in("stav", ["AKTIVNI", "POZASTAVENO", "DOKONCENO"])
      .lte("zacatek", konec.toISOString().slice(0, 10))
      .gte("konec_aktualni", start.toISOString().slice(0, 10))
      .order("priorita", { ascending: true })
      .order("zacatek", { ascending: true });

    const zakazky = (data ?? []) as unknown as ZakazkaRowT[];

    radky = zakazky.map((z) => {
      const stavova = { konecAktualni: parseDay(z.konec_aktualni), stav: z.stav };
      const prodlouzeno = z.konec_aktualni !== z.konec_puvodni;
      const prirazeni = z.prirazeni
        .filter((p) => !p.deleted_at)
        .sort((a, b) => a.datum_od.localeCompare(b.datum_od));
      const milniky = z.milniky.filter((m) => !m.deleted_at);

      // pracovníci jako rozbalitelné podřádky – každý svou barvou
      const poradiP: string[] = [];
      for (const p of prirazeni) if (!poradiP.includes(p.osoba_id)) poradiP.push(p.osoba_id);
      const podleOsoby = new Map<string, TRadek>();
      for (const p of prirazeni) {
        if (!podleOsoby.has(p.osoba_id)) {
          podleOsoby.set(p.osoba_id, {
            id: `${z.id}:${p.osoba_id}`,
            label: p.osoba?.name ?? "?",
            pocetRad: 1,
            bary: [],
            znacky: [],
          });
        }
        podleOsoby.get(p.osoba_id)!.bary.push({
          od: parseDay(p.datum_od),
          do: parseDay(p.datum_do),
          lane: 0,
          barva: PALETA_PRAC[poradiP.indexOf(p.osoba_id) % PALETA_PRAC.length]!,
          titulek: `${p.osoba?.name ?? "?"}: ${formatCz(parseDay(p.datum_od))} – ${formatCz(parseDay(p.datum_do))}`,
        });
      }

      return {
        id: z.id,
        label: z.kod,
        sublabel: z.misto_plneni,
        datum: `${formatCz(parseDay(z.zacatek))} – ${formatCz(parseDay(z.konec_aktualni))}`,
        href: `/zakazky/${z.id}`,
        pocetRad: 1,
        bary: [
          {
            od: parseDay(z.zacatek),
            do: parseDay(z.konec_aktualni),
            lane: 0,
            barva: barvaZakazky(stavova),
            label: z.kod,
            href: `/zakazky/${z.id}`,
            titulek: `${z.kod} — ${z.misto_plneni}`,
          },
        ],
        znacky: [
          ...(prodlouzeno
            ? [{ datum: parseDay(z.konec_puvodni), barva: BARVA.puvodni, titulek: "Původní konec" }]
            : []),
          ...milniky.map((m) => ({
            datum: parseDay(m.datum),
            barva: m.typ.includes("LAKOVANI") ? BARVA.lakovani : BARVA.vyroba,
            titulek: MILNIK_LABELS[m.typ as TypMilniku] ?? m.typ,
          })),
        ],
        podradky: Array.from(podleOsoby.values()),
      };
    });
  } else {
    // Podle zaměstnance: všechna živá přiřazení v okně, seskupená podle osoby.
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
      if (!p.osoba.active) continue;
      if (!podleOsoby.has(p.osoba_id)) podleOsoby.set(p.osoba_id, []);
      podleOsoby.get(p.osoba_id)!.push(p);
    }

    radky = Array.from(podleOsoby.entries())
      .sort((a, b) => (a[1][0]!.osoba.name).localeCompare(b[1][0]!.osoba.name, "cs"))
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
            barva: barvaZakazky({ konecAktualni: parseDay(x.p.zakazka.konec_aktualni), stav: x.p.zakazka.stav }),
            label: x.p.zakazka.kod,
            href: `/zakazky/${x.p.zakazka.id}`,
            titulek: `${x.p.zakazka.kod} — ${x.p.zakazka.misto_plneni}`,
          })),
          znacky: [],
        };
      });
  }

  const odkaz = (m: string, r: string) => `/zakazky/plan?mode=${m}&ref=${r}`;
  const refStr = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          <Link href={odkaz("zakazky", refStr)} className={`btn-ghost ${mode === "zakazky" ? "border-user-0 text-user-0" : "border-transparent"}`}>
            Podle akcí
          </Link>
          <Link href={odkaz("osoby", refStr)} className={`btn-ghost ${mode === "osoby" ? "border-user-0 text-user-0" : "border-transparent"}`}>
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
        prazdno={mode === "osoby" ? "Nikdo nemá v tomto období přiřazení." : "Žádné akce v tomto období."}
      />

      <div className="flex flex-wrap gap-4 text-xs text-text-muted">
        <Legenda barva={BARVA.aktivni} text="Aktivní" />
        <Legenda barva={BARVA.potermin} text="Po termínu" />
        <Legenda barva={BARVA.pozastaveno} text="Pozastaveno" />
        <Legenda barva={BARVA.dokonceno} text="Dokončeno" />
        <Legenda barva={BARVA.vyroba} text="Milník výroba" kosoctverec />
        <Legenda barva={BARVA.lakovani} text="Milník lakování" kosoctverec />
      </div>
    </div>
  );
}

function Legenda({ barva, text, kosoctverec }: { barva: string; text: string; kosoctverec?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 ${kosoctverec ? "rotate-45" : "rounded"}`} style={{ backgroundColor: barva }} />
      {text}
    </span>
  );
}
