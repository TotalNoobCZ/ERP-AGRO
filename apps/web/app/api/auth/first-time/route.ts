import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Flow „Jsem tu poprvé" (ZADANI.md kap. 3):
 * 1. admin založil profil (e-mail bez hesla, auth_user_id = null)
 * 2. uživatel zadá svůj e-mail + nové heslo
 * 3. e-mail odpovídá profilu bez auth účtu → založí se auth.users záznam
 *    s heslem (bez ověřovacího mailu) a napojí se profiles.auth_user_id
 * 4. e-mail neodpovídá → odmítnout
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || password.length < 8) {
    return NextResponse.json(
      { error: "Zadej e-mail a heslo (alespoň 8 znaků)." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Profil musí existovat, být aktivní a bez napojeného auth účtu.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, auth_user_id, active")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Chyba databáze." }, { status: 500 });
  }
  if (!profile || !profile.active) {
    // E-mail není mezi založenými profily → odmítnout (dle zadání).
    return NextResponse.json(
      { error: "Tento e-mail není v systému založen. Obrať se na vedoucího." },
      { status: 403 },
    );
  }
  if (profile.auth_user_id) {
    return NextResponse.json(
      { error: "Účet už má nastavené heslo. Přihlas se, nebo požádej o reset." },
      { status: 409 },
    );
  }

  // Založit auth uživatele s heslem, e-mail rovnou potvrzený (maily se neposílají).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: "Účet se nepodařilo založit. Zkus to prosím znovu." },
      { status: 500 },
    );
  }

  // Napojit auth účet na profil.
  const { error: linkError } = await admin
    .from("profiles")
    .update({ auth_user_id: created.user.id })
    .eq("id", profile.id);

  if (linkError) {
    // Rollback, ať nezůstane osiřelý auth účet.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Napojení účtu selhalo. Zkus to prosím znovu." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
