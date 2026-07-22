import { getCurrentProfile } from "@/lib/supabase/server";
import { guardModul } from "@/lib/pristup";
import { KonstrukceSubNav } from "@/components/konstrukce/sub-nav";
import { canWrite, type Role } from "@erp/core";

/** Layout modulu Konstrukce – karty Plánování / Gantt / Archiv (ZADANI.md). */
export default async function KonstrukceLayout({ children }: { children: React.ReactNode }) {
  await guardModul("konstrukce");
  const profile = await getCurrentProfile();
  const writer = profile ? canWrite(profile.role as Role) : false;
  return (
    <div>
      <KonstrukceSubNav canWrite={writer} />
      {children}
    </div>
  );
}
