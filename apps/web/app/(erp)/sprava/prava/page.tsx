// Plošná přístupová práva k modulům dle oddělení – jen administrátor.
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { isAdmin, type Role } from "@erp/core";
import { PravaForm } from "@/components/sprava/PravaForm";
import { ulozitDepartmentAccess } from "../actions";

export const dynamic = "force-dynamic";

export default async function PravaPage() {
  const me = await getCurrentProfile();
  if (!me || !isAdmin(me.role as Role)) redirect("/heslo");

  const supabase = await createClient();
  const { data } = await supabase.from("department_access").select("oddeleni, modules");
  const initial: Record<string, string[]> = {};
  for (const r of data ?? []) initial[r.oddeleni as string] = (r.modules as string[]) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Přístupová práva k modulům</h1>
      <PravaForm akce={ulozitDepartmentAccess} initial={initial} />
    </div>
  );
}
