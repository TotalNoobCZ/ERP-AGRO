// Karta Gantt – řádky členů týmu, úkoly jako tahatelné žížaly, absence na ose.
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { nactiKonstrukci } from "@/lib/konstrukce-query";
import GanttBoard from "@/components/konstrukce/GanttBoard";
import { canWrite, type Role } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function GanttPage() {
  const supabase = await createClient();
  const [{ clenove, ukoly, absence }, profile] = await Promise.all([
    nactiKonstrukci(supabase),
    getCurrentProfile(),
  ]);
  const editable = profile ? canWrite(profile.role as Role) : false;

  return <GanttBoard clenove={clenove} ukoly={ukoly} absence={absence} editable={editable} />;
}
