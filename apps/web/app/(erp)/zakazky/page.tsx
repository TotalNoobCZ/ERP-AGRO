// Seznam akcí (zakázek) s filtry – port z Planovani/app/(app)/zakazky/page.tsx.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { poTerminu } from "@/lib/zakazky/orders";
import { StavBadge } from "@/components/zakazky/common";
import { ZAKAZKA_STAVY, type StavZakazky } from "@erp/core";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  kod: string;
  misto_plneni: string;
  priorita: number;
  konec_aktualni: string;
  stav: StavZakazky;
  inquiry_id: string | null;
  prirazeni: { count: number }[];
};

export default async function ZakazkyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stav?: string; priorita?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const stav = sp.stav;
  const priorita = sp.priorita ? Number(sp.priorita) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("zakazky")
    .select("id, kod, misto_plneni, priorita, konec_aktualni, stav, inquiry_id, prirazeni:prirazeni_zakazka(count)")
    .is("deleted_at", null)
    .order("priorita", { ascending: true })
    .order("konec_aktualni", { ascending: true });

  if (q) query = query.or(`kod.ilike.%${q}%,misto_plneni.ilike.%${q}%`);
  if (stav && stav !== "PO_TERMINU" && (ZAKAZKA_STAVY as readonly string[]).includes(stav)) {
    query = query.eq("stav", stav as StavZakazky);
  } else if (stav !== "PO_TERMINU") {
    // výchozí i "Vše" skryje archivované – ty mají vlastní záložku Archiv
    query = query.neq("stav", "ARCHIV");
  }
  if (priorita) query = query.eq("priorita", priorita);

  const { data } = await query;
  let zakazky = (data ?? []) as unknown as Row[];

  // "Po termínu" je odvozený filtr.
  if (stav === "PO_TERMINU") {
    zakazky = zakazky.filter((z) =>
      poTerminu({ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }),
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Akce</h1>
      </div>

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" action="/zakazky">
        <div className="grow">
          <label className="label">Hledat (kód / místo)</label>
          <input name="q" className="field" defaultValue={q} placeholder="např. Z-2026-001" />
        </div>
        <div>
          <label className="label">Stav</label>
          <select name="stav" className="field" defaultValue={stav ?? ""}>
            <option value="">Vše</option>
            <option value="AKTIVNI">Aktivní</option>
            <option value="PO_TERMINU">Po termínu</option>
            <option value="POZASTAVENO">Pozastaveno</option>
            <option value="DOKONCENO">Dokončeno</option>
            <option value="ARCHIV">Archiv</option>
          </select>
        </div>
        <div>
          <label className="label">Priorita</label>
          <select name="priorita" className="field" defaultValue={sp.priorita ?? ""}>
            <option value="">Vše</option>
            <option value={1}>1 – nejvyšší</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5 – nejnižší</option>
          </select>
        </div>
        <button className="btn-ghost" type="submit">Filtrovat</button>
      </form>

      <p className="mb-2 text-xs text-text-muted">P1 = nejvyšší priorita · P5 = nejnižší</p>

      {zakazky.length === 0 ? (
        <p className="text-sm text-text-muted">Žádné akce neodpovídají filtru.</p>
      ) : (
        <div className="card divide-y divide-white/5">
          {zakazky.map((z) => (
            <Link key={z.id} href={`/zakazky/${z.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-accent">
              <span title="Priorita (1 = nejvyšší, 5 = nejnižší)" className="w-8 text-center text-xs font-semibold text-text-muted">
                P{z.priorita}
              </span>
              <span className="font-mono text-sm font-semibold">{z.kod}</span>
              <span className="flex-1 truncate text-sm text-text-muted">{z.misto_plneni}</span>
              {z.inquiry_id && (
                <span title="Vznikla z poptávky" className="hidden text-xs text-user-0 sm:inline">z poptávky</span>
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
