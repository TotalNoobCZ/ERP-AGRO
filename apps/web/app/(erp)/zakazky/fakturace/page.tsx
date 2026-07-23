// Lišta Fakturace – finále akce. Dvě sekce: „Fakturace" (dokončené akce, u nichž
// se řeší vystavení faktury a platba) a „Proplaceno" (zaplacené = hotové).
import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { StavBadge } from "@/components/zakazky/common";
import { FakturaceAkce } from "@/components/zakazky/FakturaceAkce";
import { canWrite, type Role, type StavZakazky } from "@erp/core";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  kod: string;
  misto_plneni: string;
  popis: string | null;
  konec_aktualni: string;
  stav: StavZakazky;
  customer: { name: string } | null;
  odpovedna: { name: string } | null;
};

function AkceRadek({ z, editable }: { z: Row; editable: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link href={`/zakazky/${z.id}`} className="font-mono font-semibold text-link hover:underline">
          {z.kod}
        </Link>
        {(z.popis || z.misto_plneni) && (
          <span className="ml-2 text-sm text-text-muted">{z.popis || z.misto_plneni}</span>
        )}
        <div className="text-xs text-text-muted">
          {z.customer?.name ?? "—"} · konec {formatCz(parseDay(z.konec_aktualni))}
          {z.odpovedna?.name ? ` · ${z.odpovedna.name}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StavBadge z={{ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }} />
        {editable && <FakturaceAkce id={z.id} stav={z.stav} />}
      </div>
    </div>
  );
}

export default async function FakturacePage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const editable = profile ? canWrite(profile.role as Role) : false;

  const { data } = await supabase
    .from("zakazky")
    .select("id, kod, misto_plneni, popis, konec_aktualni, stav, customer:customers(name), odpovedna:profiles!zakazky_odpovedna_osoba_id_fkey(name)")
    .is("deleted_at", null)
    .in("stav", ["FAKTURACE", "PROPLACENO"])
    .order("konec_aktualni", { ascending: true });

  const rows = (data ?? []) as unknown as Row[];
  const kFakturaci = rows.filter((z) => z.stav === "FAKTURACE");
  const proplacene = rows.filter((z) => z.stav === "PROPLACENO");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fakturace</h1>
        <p className="text-sm text-text-muted">
          Finále akce: dokončená akce jde do fakturace, po zaplacení je „Proplaceno" (hotové).
        </p>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
          Fakturace – čeká na proplacení ({kFakturaci.length})
        </h2>
        <div className="card divide-y divide-line">
          {kFakturaci.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted">Žádná akce ve fakturaci.</p>
          ) : (
            kFakturaci.map((z) => <AkceRadek key={z.id} z={z} editable={editable} />)
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Proplaceno – hotové ({proplacene.length})
        </h2>
        <div className="card divide-y divide-line">
          {proplacene.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted">Zatím nic proplaceného.</p>
          ) : (
            proplacene.map((z) => <AkceRadek key={z.id} z={z} editable={editable} />)
          )}
        </div>
      </section>
    </div>
  );
}
