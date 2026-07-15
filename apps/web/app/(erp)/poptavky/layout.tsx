import { getCurrentProfile } from "@/lib/supabase/server";
import { PoptavkySubNav } from "@/components/poptavky/sub-nav";
import { canWrite, type Role } from "@erp/core";

/** Layout modulu Poptávky – podnavigace (Dashboard/Poptávky/Objednáno/Zákazníci). */
export default async function PoptavkyLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const writer = profile ? canWrite(profile.role as Role) : false;
  return (
    <div>
      <PoptavkySubNav canWrite={writer} />
      {children}
    </div>
  );
}
