// Tiskový export plánu (akce + přiřazení + milníky), tabulkově.
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { stavLabel } from "@/lib/zakazky/orders";
import { formatDate } from "@/lib/format";
import { MILNIK_LABELS, type StavZakazky, type TypMilniku } from "@erp/core";

export const dynamic = "force-dynamic";

type Row = {
  id: string; kod: string; misto_plneni: string; priorita: number;
  zacatek: string; konec_aktualni: string; stav: StavZakazky;
  prirazeni: { datum_od: string; datum_do: string; deleted_at: string | null; osoba: { name: string } | null }[];
  milniky: { typ: string; datum: string; deleted_at: string | null }[];
};

export default async function PlanPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ print?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("zakazky")
    .select(
      `id, kod, misto_plneni, priorita, zacatek, konec_aktualni, stav,
       prirazeni:prirazeni_zakazka(datum_od, datum_do, deleted_at, osoba:profiles(name)),
       milniky(typ, datum, deleted_at)`,
    )
    .is("deleted_at", null)
    .in("stav", ["AKTIVNI", "POZASTAVENO", "DOKONCENO"])
    .order("priorita", { ascending: true })
    .order("konec_aktualni", { ascending: true });
  const zakazky = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black">
      <PrintButton auto={sp?.print === "1"} />
      <div className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold">Plán akcí</h1>
        <p className="text-sm text-gray-500">Vytištěno {formatDate(new Date())}</p>
      </div>

      {zakazky.length === 0 && <p className="text-sm text-gray-500">Žádné akce.</p>}
      <div className="space-y-4">
        {zakazky.map((z) => {
          const prir = z.prirazeni.filter((p) => !p.deleted_at);
          const miln = z.milniky.filter((m) => !m.deleted_at);
          return (
            <div key={z.id} className="break-inside-avoid border-b border-gray-200 pb-3">
              <p className="text-sm">
                <span className="font-mono font-semibold">{z.kod}</span> · {z.misto_plneni} · P{z.priorita} ·{" "}
                {formatCz(parseDay(z.zacatek))} – {formatCz(parseDay(z.konec_aktualni))} ·{" "}
                {stavLabel({ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav })}
              </p>
              {prir.length > 0 && (
                <p className="mt-0.5 text-xs text-gray-600">
                  Pracovníci: {prir.map((p) => `${p.osoba?.name ?? "?"} (${formatCz(parseDay(p.datum_od))}–${formatCz(parseDay(p.datum_do))})`).join(", ")}
                </p>
              )}
              {miln.length > 0 && (
                <p className="mt-0.5 text-xs text-gray-600">
                  Milníky: {miln.map((m) => `${MILNIK_LABELS[m.typ as TypMilniku] ?? m.typ} ${formatCz(parseDay(m.datum))}`).join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
