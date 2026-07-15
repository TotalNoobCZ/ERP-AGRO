import { getCurrentProfile } from "@/lib/supabase/server";
import { ProfilForm } from "@/components/sprava/ProfilForm";
import { vytvoritProfil } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovyProfilPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return <p className="text-sm text-text-muted">Správa uživatelů je jen pro administrátory.</p>;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nový uživatel</h1>
      <ProfilForm akce={vytvoritProfil} />
    </div>
  );
}
