// Detail zakázky v modulu Dílna – podrobný pohled pro mistra: výrobní fáze,
// uskladnění, přiřazení pracovníci z dílen a zakázky k akci. Zůstává v Dílně
// (karta Zakázky slouží jen jako hlavní přehled, kam se info propisuje).
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { DilnaZakazkaEditor } from "@/components/dilna/DilnaZakazkaEditor";
import { formatDen } from "@/lib/format";
import { canWrite, DILNA_FAZE, type DilnaFaze, type Role } from "@erp/core";
import type { DilnaZakazka } from "@/lib/dilna-query";

export const dynamic = "force-dynamic";

const VYBER =
  "id, kod, misto_plneni, popis, parent_id, zacatek, konec_aktualni, stav, ulozeni, " +
  "dilna_faze:dilna_faze(typ, datum_od, datum_do, poznamka), " +
  "prirazeni:prirazeni_zakazka(id, osoba_id, datum_od, datum_do, deleted_at, osoba:profiles(name, oddeleni))";

type Raw = {
  id: string;
  kod: string;
  misto_plneni: string;
  popis: string | null;
  parent_id: string | null;
  zacatek: string;
  konec_aktualni: string;
  stav: string;
  ulozeni: string | null;
  dilna_faze: Array<{ typ: string; datum_od: string | null; datum_do: string | null; poznamka: string | null }> | null;
  prirazeni: Array<{
    id: string;
    osoba_id: string;
    datum_od: string;
    datum_do: string;
    deleted_at: string | null;
    osoba: { name: string; oddeleni: string | null } | null;
  }> | null;
};

function naDilnaZakazku(z: Raw): DilnaZakazka {
  const faze: Partial<Record<DilnaFaze, { typ: DilnaFaze; datumOd: string | null; datumDo: string | null; poznamka: string | null }>> = {};
  for (const f of z.dilna_faze ?? []) {
    if ((DILNA_FAZE as readonly string[]).includes(f.typ)) {
      faze[f.typ as DilnaFaze] = { typ: f.typ as DilnaFaze, datumOd: f.datum_od, datumDo: f.datum_do, poznamka: f.poznamka };
    }
  }
  return {
    id: z.id,
    kod: z.kod,
    mistoPlneni: z.misto_plneni,
    popis: z.popis,
    parentId: z.parent_id,
    zacatek: z.zacatek,
    konecAktualni: z.konec_aktualni,
    stav: z.stav,
    ulozeni: z.ulozeni,
    faze,
  };
}

function Pracovnici({ z }: { z: Raw }) {
  const lide = (z.prirazeni ?? []).filter((p) => !p.deleted_at);
  if (lide.length === 0) return <p className="text-xs text-text-muted">Zatím nikdo přiřazen.</p>;
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {lide.map((p) => (
        <li key={p.id} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1">
          <span className="font-medium">{p.osoba?.name ?? "?"}</span>
          <span className="text-text-muted">{formatDen(p.datum_od)} – {formatDen(p.datum_do)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function DilnaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const editable = profile ? canWrite(profile.role as Role) : false;

  const { data } = await supabase.from("zakazky").select(VYBER).eq("id", id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const z = data as unknown as Raw;

  const { data: detiData } = await supabase
    .from("zakazky")
    .select(VYBER)
    .eq("parent_id", id)
    .is("deleted_at", null)
    .order("kod", { ascending: true });
  const deti = (detiData ?? []) as unknown as Raw[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dilna" className="text-sm text-text-muted hover:text-text">← Dílna</Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            <span className="font-mono">{z.kod}</span>{" "}
            <span className="text-base font-normal text-text-muted">{z.popis || z.misto_plneni}</span>
          </h1>
          <p className="text-sm text-text-muted">
            {formatDen(z.zacatek)} – {formatDen(z.konec_aktualni)} · {z.stav}
          </p>
        </div>
        <Link href={`/zakazky/${z.id}`} className="btn-ghost">Otevřít v Zakázkách →</Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Výrobní fáze a uskladnění</h2>
        <DilnaZakazkaEditor zakazka={naDilnaZakazku(z)} editable={editable} />
        <div className="rounded-lg border border-line p-3">
          <p className="mb-1 text-xs font-semibold text-text-muted">Přiřazení pracovníci</p>
          <Pracovnici z={z} />
          <p className="mt-2 text-xs text-text-muted">Přiřazuje se na Tabuli (Dílna → Tabule).</p>
        </div>
      </section>

      {deti.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Zakázky k akci</h2>
          <div className="space-y-3 border-l-2 border-link/30 pl-4">
            {deti.map((d) => (
              <div key={d.id} className="space-y-2">
                <DilnaZakazkaEditor zakazka={naDilnaZakazku(d)} editable={editable} />
                <div className="rounded-lg border border-line p-3">
                  <p className="mb-1 text-xs font-semibold text-text-muted">Přiřazení pracovníci</p>
                  <Pracovnici z={d} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
