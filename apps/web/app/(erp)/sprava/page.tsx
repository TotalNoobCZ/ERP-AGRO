import { getCurrentProfile } from "@/lib/supabase/server";
import { ROLE_LABELS, isAdmin, type Role } from "@erp/core";

export default async function SpravaPage() {
  const profile = await getCurrentProfile();
  const role = (profile?.role ?? "viewer") as Role;

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Správa</h1>
      {isAdmin(role) ? (
        <p className="text-text-muted">
          Správa uživatelů (zakládání profilů, role, barvy, dlaždice) se doplní
          v kroku 4. Tvoje role: {ROLE_LABELS[role]}.
        </p>
      ) : (
        <p className="text-text-muted">
          Zde si budeš moci změnit heslo. Tvoje role: {ROLE_LABELS[role]}.
        </p>
      )}
    </div>
  );
}
