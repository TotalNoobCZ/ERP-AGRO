// Úprava akce + správa pracovníků – port z Planovani.
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { muzeOdebratKonstruktera } from "@erp/core";
import { formatDay, today } from "@/lib/zakazky/dates";
import { ZakazkaEditForm } from "@/components/zakazky/formulare";
import PracovniciEditor from "@/components/zakazky/PracovniciEditor";
import type { OsobaLite } from "@/components/zakazky/common";
import { upravitZakazku, type ZakazkaStav } from "../../actions";

export const dynamic = "force-dynamic";

export default async function UpravitZakazkuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("zakazky")
    .select(
      `id, kod, misto_plneni, priorita, zacatek, konec_aktualni, poznamka, odpovedna_osoba_id, parent_id, deleted_at,
       prirazeni:prirazeni_zakazka(id, osoba_id, datum_od, datum_do, deleted_at, osoba:profiles(name, oddeleni))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || data.deleted_at) notFound();
  const z = data as unknown as {
    id: string;
    kod: string;
    misto_plneni: string;
    priorita: number;
    zacatek: string;
    konec_aktualni: string;
    poznamka: string | null;
    odpovedna_osoba_id: string | null;
    parent_id: string | null;
    prirazeni: { id: string; osoba_id: string; datum_od: string; datum_do: string; deleted_at: string | null; osoba: { name: string; oddeleni: string | null } | null }[];
  };
  const prirazeni = z.prirazeni
    .filter((p) => !p.deleted_at)
    .sort((a, b) => a.datum_od.localeCompare(b.datum_od));

  // Odpovědná osoba = Kancelář / Projekťák / role Vedoucí; pracovníci = přiřaditelní mimo Kancelář.
  const [{ data: vsichni }, { data: odpovedniData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, oddeleni")
      .eq("active", true)
      .eq("assignable", true)
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, name, oddeleni")
      .eq("active", true)
      .or("oddeleni.eq.projektak,role.eq.vedouci")
      .order("name", { ascending: true }),
  ]);
  const osoby = (vsichni ?? []) as OsobaLite[];
  const odpovedniOsoby = (odpovedniData ?? []) as OsobaLite[];
  const pracovnici = osoby.filter((o) => o.oddeleni !== "kancelar");

  const me = await getCurrentProfile();
  const smiOdebratKonstruktera = me
    ? muzeOdebratKonstruktera({ role: me.role, sefkonstrukter: me.sefkonstrukter })
    : false;

  const akce = upravitZakazku.bind(null, z.id) as (prev: ZakazkaStav, fd: FormData) => Promise<ZakazkaStav>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Úprava akce {z.kod}</h1>

      <ZakazkaEditForm
        akce={akce}
        osoby={odpovedniOsoby}
        jePodzakazka={!!z.parent_id}
        zakazka={{
          id: z.id,
          kod: z.kod,
          mistoPlneni: z.misto_plneni,
          priorita: z.priorita,
          zacatek: z.zacatek,
          poznamka: z.poznamka,
          odpovednaOsobaId: z.odpovedna_osoba_id,
        }}
      />

      <PracovniciEditor
        zakazkaId={z.id}
        konecAkce={z.konec_aktualni}
        dnes={formatDay(today())}
        pracovnici={pracovnici}
        muzeOdebratKonstruktera={smiOdebratKonstruktera}
        prirazeni={prirazeni.map((p) => ({
          id: p.id,
          osobaId: p.osoba_id,
          jmeno: p.osoba?.name ?? "?",
          od: p.datum_od,
          do: p.datum_do,
          jeKonstrukter: p.osoba?.oddeleni === "konstrukce",
        }))}
      />
    </div>
  );
}
