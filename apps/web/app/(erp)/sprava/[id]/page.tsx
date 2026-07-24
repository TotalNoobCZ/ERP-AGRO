import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfilForm } from "@/components/sprava/ProfilForm";
import { HesloSprava } from "@/components/sprava/HesloSprava";
import { upravitProfil, type ProfilStav } from "../actions";

export const dynamic = "force-dynamic";

export default async function UpravitProfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentProfile();
  if (me?.role !== "admin") {
    return <p className="text-sm text-text-muted">Správa uživatelů je jen pro administrátory.</p>;
  }

  // Citlivé sloupce (email, poznamka) čteme přes service-role klienta – stránka
  // je jen pro adminy (výše). Ostatní pole by šla i běžně, ale kvůli jedné
  // konzistentní čtečce použijeme admin klienta na celý profil.
  const supabase = createAdminClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("id, name, email, role, oddeleni, assignable, sefkonstrukter, access_modules, color_index, active, pozice, osobni_cislo, poznamka, auth_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const akce = upravitProfil.bind(null, p.id) as (prev: ProfilStav, fd: FormData) => Promise<ProfilStav>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upravit uživatele</h1>
      <ProfilForm
        akce={akce}
        initial={{
          id: p.id,
          name: p.name,
          email: p.email ?? "",
          role: p.role,
          oddeleni: p.oddeleni,
          assignable: p.assignable,
          sefkonstrukter: p.sefkonstrukter,
          accessModules: p.access_modules,
          colorIndex: p.color_index,
          active: p.active,
          pozice: p.pozice,
          osobniCislo: p.osobni_cislo,
          poznamka: p.poznamka,
          maUcet: Boolean(p.auth_user_id),
        }}
      />
      <HesloSprava
        profileId={p.id}
        maUcet={Boolean(p.auth_user_id)}
        maEmail={Boolean(p.email)}
        jmeno={p.name}
      />
    </div>
  );
}
