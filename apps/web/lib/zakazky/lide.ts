// Sdílené: „lidé na zakázce" = přiřazení pracovníci (dělníci/elektrikáři,
// a konstruktéři propsaní z konstrukce) + odpovědná osoba. Rolluje se nahoru
// na akci (akce = ona sama + všechny její zakázky k akci).
import type { createClient } from "@/lib/supabase/server";

export type Osoba = { id: string; name: string; oddeleni: string | null; colorIndex: number | null };

type Db = Awaited<ReturnType<typeof createClient>>;

/** Vrátí mapu zakazka_id → seznam osob (bez duplicit, řazeno dle jména). */
export async function nacistLidiZakazek(supabase: Db, ids: string[]): Promise<Map<string, Osoba[]>> {
  const map = new Map<string, Osoba[]>();
  if (ids.length === 0) return map;

  const add = (zid: string, o: Osoba | null | undefined) => {
    if (!o || !o.id) return;
    if (!map.has(zid)) map.set(zid, []);
    const arr = map.get(zid)!;
    if (!arr.some((x) => x.id === o.id)) arr.push(o);
  };

  const [prirRes, zakRes] = await Promise.all([
    supabase
      .from("prirazeni_zakazka")
      .select("zakazka_id, deleted_at, osoba:profiles(id, name, oddeleni, color_index)")
      .in("zakazka_id", ids)
      .is("deleted_at", null),
    supabase
      .from("zakazky")
      .select("id, odpovedna:profiles!zakazky_odpovedna_osoba_id_fkey(id, name, oddeleni, color_index)")
      .in("id", ids),
  ]);

  type RawOsoba = { id: string; name: string; oddeleni: string | null; color_index: number | null } | null;
  const norm = (o: RawOsoba): Osoba | null =>
    o ? { id: o.id, name: o.name, oddeleni: o.oddeleni, colorIndex: o.color_index } : null;

  for (const p of (prirRes.data ?? []) as unknown as { zakazka_id: string; osoba: RawOsoba }[]) {
    add(p.zakazka_id, norm(p.osoba));
  }
  for (const z of (zakRes.data ?? []) as unknown as { id: string; odpovedna: RawOsoba }[]) {
    add(z.id, norm(z.odpovedna));
  }

  for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  return map;
}

/** Sjednotí osoby z více zakázek (akce = ona + její zakázky k akci). */
export function sjednotitOsoby(seznamy: (Osoba[] | undefined)[]): Osoba[] {
  const out: Osoba[] = [];
  for (const s of seznamy) {
    for (const o of s ?? []) if (!out.some((x) => x.id === o.id)) out.push(o);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "cs"));
}
