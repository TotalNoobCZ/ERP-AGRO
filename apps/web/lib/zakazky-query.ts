// Sdílená dotazová logika modulu Zakázky – seznam, filtry, dashboard i tisk.
import type { createClient } from "@/lib/supabase/server";
import { parseDay } from "@/lib/zakazky/dates";
import { poTerminu } from "@/lib/zakazky/orders";
import { ZAKAZKA_STAVY, type StavZakazky } from "@erp/core";

export type ZakazkaListParams = { q?: string; stav?: string; priorita?: string };

export type ZakazkaListRow = {
  id: string;
  kod: string;
  misto_plneni: string;
  priorita: number;
  zacatek: string;
  konec_aktualni: string;
  stav: StavZakazky;
  inquiry_id: string | null;
  odpovedna: { name: string } | null;
  prirazeni: { count: number }[];
};

export async function queryZakazky(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: ZakazkaListParams,
): Promise<ZakazkaListRow[]> {
  const q = params.q?.trim();
  const stav = params.stav;
  const priorita = params.priorita ? Number(params.priorita) : undefined;

  let query = supabase
    .from("zakazky")
    .select(
      "id, kod, misto_plneni, priorita, zacatek, konec_aktualni, stav, inquiry_id, odpovedna:profiles!zakazky_odpovedna_osoba_id_fkey(name), prirazeni:prirazeni_zakazka(count)",
    )
    .is("deleted_at", null)
    .order("priorita", { ascending: true })
    .order("konec_aktualni", { ascending: true });

  if (q) query = query.or(`kod.ilike.%${q}%,misto_plneni.ilike.%${q}%`);
  if (stav && stav !== "PO_TERMINU" && (ZAKAZKA_STAVY as readonly string[]).includes(stav)) {
    query = query.eq("stav", stav as StavZakazky);
  } else if (stav !== "PO_TERMINU") {
    query = query.neq("stav", "ARCHIV");
  }
  if (priorita) query = query.eq("priorita", priorita);

  const { data } = await query;
  let rows = (data ?? []) as unknown as ZakazkaListRow[];
  if (stav === "PO_TERMINU") {
    rows = rows.filter((z) => poTerminu({ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav }));
  }
  return rows;
}
