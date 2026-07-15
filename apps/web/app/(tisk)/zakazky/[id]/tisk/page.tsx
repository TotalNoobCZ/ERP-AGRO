// Tiskový export detailu akce.
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { formatDateTime } from "@/lib/format";
import { MILNIK_LABELS, ZAKAZKA_STAV_LABELS, type StavZakazky, type TypMilniku } from "@erp/core";

export const dynamic = "force-dynamic";

type Detail = {
  id: string; kod: string; misto_plneni: string; priorita: number;
  zacatek: string; konec_puvodni: string; konec_aktualni: string; stav: StavZakazky; poznamka: string | null;
  customer: { name: string } | null;
  inquiry: { number: number; subject: string } | null;
  odpovedna: { name: string } | null;
  prirazeni: { id: string; datum_od: string; datum_do: string; deleted_at: string | null; osoba: { name: string } | null }[];
  milniky: { id: string; typ: string; datum: string; cas: string | null; deleted_at: string | null }[];
  poznamky: { id: string; text: string; created_at: string; deleted_at: string | null; uzivatel: { name: string } | null }[];
};

export default async function ZakazkaPrintPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("zakazky")
    .select(
      `id, kod, misto_plneni, priorita, zacatek, konec_puvodni, konec_aktualni, stav, poznamka,
       customer:customers(name), inquiry:inquiries(number, subject),
       odpovedna:profiles!zakazky_odpovedna_osoba_id_fkey(name),
       prirazeni:prirazeni_zakazka(id, datum_od, datum_do, deleted_at, osoba:profiles(name)),
       milniky(id, typ, datum, cas, deleted_at),
       poznamky:akce_poznamky(id, text, created_at, deleted_at, uzivatel:profiles(name))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const z = data as unknown as Detail;
  const prirazeni = z.prirazeni.filter((p) => !p.deleted_at).sort((a, b) => a.datum_od.localeCompare(b.datum_od));
  const milniky = z.milniky.filter((m) => !m.deleted_at).sort((a, b) => a.datum.localeCompare(b.datum));
  const poznamky = z.poznamky.filter((p) => !p.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black">
      <PrintButton auto={sp?.print === "1"} />
      <div className="mb-6 border-b border-gray-300 pb-4">
        <p className="text-sm text-gray-500">Akce</p>
        <h1 className="font-mono text-2xl font-bold">{z.kod}</h1>
        <p className="mt-1 text-sm">
          {z.misto_plneni} · stav <strong>{ZAKAZKA_STAV_LABELS[z.stav]}</strong> · priorita {z.priorita}
        </p>
        {z.inquiry && <p className="text-sm text-gray-500">z poptávky #{z.inquiry.number} · {z.inquiry.subject}</p>}
        {z.customer && <p className="text-sm text-gray-500">zákazník: {z.customer.name}</p>}
      </div>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-lg font-semibold">Termíny</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Začátek" value={formatCz(parseDay(z.zacatek))} />
            <Row label="Původní konec" value={formatCz(parseDay(z.konec_puvodni))} />
            <Row label="Aktuální konec" value={formatCz(parseDay(z.konec_aktualni))} />
            <Row label="Odpovědná osoba" value={z.odpovedna?.name ?? "—"} />
          </tbody>
        </table>
        {z.poznamka && <p className="mt-2 text-sm">{z.poznamka}</p>}
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-lg font-semibold">Přiřazení pracovníci</h2>
        {prirazeni.length === 0 ? <p className="text-sm text-gray-500">Žádní.</p> : (
          <ul className="space-y-1 text-sm">
            {prirazeni.map((p) => (
              <li key={p.id}>{p.osoba?.name ?? "?"} — {formatCz(parseDay(p.datum_od))} – {formatCz(parseDay(p.datum_do))}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-lg font-semibold">Milníky</h2>
        {milniky.length === 0 ? <p className="text-sm text-gray-500">Žádné.</p> : (
          <ul className="space-y-1 text-sm">
            {milniky.map((m) => (
              <li key={m.id}>{MILNIK_LABELS[m.typ as TypMilniku] ?? m.typ}: {formatCz(parseDay(m.datum))}{m.cas ? ` ${m.cas}` : ""}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Poznámky</h2>
        {poznamky.length === 0 ? <p className="text-sm text-gray-500">Žádné.</p> : (
          <ul className="space-y-2 text-sm">
            {poznamky.map((p) => (
              <li key={p.id} className="break-inside-avoid rounded border border-gray-200 p-2">
                <p className="whitespace-pre-wrap">{p.text}</p>
                <p className="mt-1 text-xs text-gray-500">{p.uzivatel?.name ?? "?"} · {formatDateTime(p.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-gray-400">Vytištěno {formatDateTime(new Date())} · Zakázky</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="w-40 py-1 align-top text-gray-500">{label}</td>
      <td className="py-1 align-top font-medium">{value}</td>
    </tr>
  );
}
