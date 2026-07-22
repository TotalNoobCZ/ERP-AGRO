"use server";
// Server actions modulu Dílna: výrobní fáze (termíny od–do) a uskladnění.
// Přiřazování lidí využívá akce z modulu Zakázky (prirazeni_zakazka).
import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { canWrite, DILNA_FAZE, type DilnaFaze, type Role } from "@erp/core";

type Vysledek = { ok: true } | { ok: false; chyba: string };

const DEN_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireWriter(): Promise<{ ok: true } | { ok: false; chyba: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, chyba: "Nejste přihlášen(a)." };
  if (!canWrite(profile.role as Role)) return { ok: false, chyba: "Nemáte oprávnění k zápisu." };
  return { ok: true };
}

/**
 * Uloží (upsertne) výrobní fázi zakázky. Když jsou obě data prázdná, fázi smaže
 * (fáze se přestane plánovat). Termíny se propisují do ganttu i k zakázce.
 */
export async function ulozitFazi(
  zakazkaId: string,
  typ: DilnaFaze,
  datumOd: string | null,
  datumDo: string | null,
  poznamka?: string | null,
): Promise<Vysledek> {
  const auth = await requireWriter();
  if (!auth.ok) return auth;
  if (!(DILNA_FAZE as readonly string[]).includes(typ)) return { ok: false, chyba: "Neplatná fáze." };

  const od = datumOd?.trim() || null;
  const doo = datumDo?.trim() || null;
  if (od && !DEN_RE.test(od)) return { ok: false, chyba: "Neplatné datum od." };
  if (doo && !DEN_RE.test(doo)) return { ok: false, chyba: "Neplatné datum do." };
  if (od && doo && doo < od) return { ok: false, chyba: "Konec fáze nesmí být před začátkem." };

  const supabase = await createClient();
  const pozn = poznamka?.trim() || null;

  // Prázdná fáze (bez termínů i poznámky) → smazat.
  if (!od && !doo && !pozn) {
    const { error } = await supabase.from("dilna_faze").delete().eq("zakazka_id", zakazkaId).eq("typ", typ);
    if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  } else {
    const { error } = await supabase
      .from("dilna_faze")
      .upsert(
        { zakazka_id: zakazkaId, typ, datum_od: od, datum_do: doo, poznamka: pozn, updated_at: new Date().toISOString() },
        { onConflict: "zakazka_id,typ" },
      );
    if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  }

  revalidatePath("/dilna");
  revalidatePath("/dilna/gantt");
  revalidatePath(`/zakazky/${zakazkaId}`);
  return { ok: true };
}

/** Uloží uskladnění dílu/stroje u zakázky (propisuje se i do Zakázek). */
export async function ulozitUlozeni(zakazkaId: string, ulozeni: string): Promise<Vysledek> {
  const auth = await requireWriter();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("zakazky")
    .update({ ulozeni: ulozeni.trim() || null })
    .eq("id", zakazkaId);
  if (error) return { ok: false, chyba: "Uložení se nezdařilo." };

  revalidatePath("/dilna");
  revalidatePath(`/zakazky/${zakazkaId}`);
  return { ok: true };
}
