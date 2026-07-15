// Karta Plánování – dlaždice členů (1/3) + masonry projektů (2/3), dnd.
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { nactiKonstrukci } from "@/lib/konstrukce-query";
import PlanBoard from "@/components/konstrukce/PlanBoard";
import { canWrite, type Role } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function KonstrukcePage() {
  const supabase = await createClient();
  const [{ clenove, projekty, ukoly, absence }, profile, zakazkyRes] = await Promise.all([
    nactiKonstrukci(supabase),
    getCurrentProfile(),
    supabase
      .from("zakazky")
      .select("id, kod, misto_plneni")
      .is("deleted_at", null)
      .neq("stav", "ARCHIV")
      .order("kod", { ascending: true }),
  ]);
  const editable = profile ? canWrite(profile.role as Role) : false;

  return (
    <PlanBoard
      clenove={clenove}
      projekty={projekty}
      ukoly={ukoly}
      absence={absence}
      zakazky={(zakazkyRes.data ?? []).map((z) => ({ id: z.id, kod: z.kod, mistoPlneni: z.misto_plneni }))}
      editable={editable}
    />
  );
}
