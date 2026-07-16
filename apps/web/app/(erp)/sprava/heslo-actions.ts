"use server";
// Správa hesel uživatelů – JEN admin (service-role, obchází RLS).
//  - nastavit konkrétní heslo, nebo
//  - vygenerovat nové náhodné heslo (admin ho předá uživateli).
// Aplikace neposílá e-maily, takže „zaslání" = admin heslo osobně předá;
// uživatel si ho pak sám změní ve Správě (komponenta ZmenaHesla).
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type HesloVysledek = {
  ok: boolean;
  heslo?: string; // vyplněné jen u vygenerovaného hesla (ať ho admin vidí)
  chyba?: string;
};

/** Náhodné, snadno předatelné heslo (bez zaměnitelných znaků 0/O, 1/l/I). */
function vygenerovatHeslo(delka = 12): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(delka));
  let out = "";
  for (let i = 0; i < delka; i++) out += abc[bytes[i]! % abc.length];
  return out;
}

/**
 * Nastaví heslo uživateli.
 * @param profileId  id profilu (ne auth uživatele)
 * @param heslo      konkrétní heslo, nebo null → vygeneruje se náhodné
 */
export async function nastavitHesloUzivateli(
  profileId: string,
  heslo: string | null,
): Promise<HesloVysledek> {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") {
    return { ok: false, chyba: "Správa hesel je jen pro administrátory." };
  }

  const generovane = !heslo;
  if (heslo && heslo.length < 8) {
    return { ok: false, chyba: "Heslo musí mít alespoň 8 znaků." };
  }
  const finalni = heslo ?? vygenerovatHeslo();

  const admin = createAdminClient();

  const { data: p, error: pErr } = await admin
    .from("profiles")
    .select("id, email, auth_user_id, active")
    .eq("id", profileId)
    .maybeSingle();
  if (pErr) return { ok: false, chyba: "Chyba databáze." };
  if (!p) return { ok: false, chyba: "Uživatel nenalezen." };
  if (!p.email) {
    return { ok: false, chyba: "Uživatel nemá e-mail – nepřihlašuje se, heslo nelze nastavit." };
  }

  if (p.auth_user_id) {
    // Účet existuje → jen změnit heslo.
    const { error } = await admin.auth.admin.updateUserById(p.auth_user_id, {
      password: finalni,
    });
    if (error) return { ok: false, chyba: "Změna hesla se nezdařila." };
  } else {
    // Uživatel ještě nemá účet → založit ho s heslem a napojit na profil
    // (stejné jako flow „Jsem tu poprvé", jen ho spouští admin).
    const { data: created, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: finalni,
      email_confirm: true,
    });
    if (error || !created.user) {
      return { ok: false, chyba: "Účet se nepodařilo založit." };
    }
    const { error: linkErr } = await admin
      .from("profiles")
      .update({ auth_user_id: created.user.id })
      .eq("id", p.id);
    if (linkErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { ok: false, chyba: "Napojení účtu selhalo." };
    }
  }

  revalidatePath("/sprava");
  revalidatePath(`/sprava/${profileId}`);
  // Heslo vracíme jen když jsme ho generovali – aby ho admin mohl předat.
  return generovane ? { ok: true, heslo: finalni } : { ok: true };
}
