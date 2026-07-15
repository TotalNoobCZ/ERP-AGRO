import { getCurrentProfile } from "@/lib/supabase/server";
import { PoptavkySubNav } from "@/components/poptavky/sub-nav";
import { canWrite, type Role } from "@erp/core";

/** Zákazníci patří do modulu Poptávky – stejná podnavigace. */
export default async function ZakazniciLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const writer = profile ? canWrite(profile.role as Role) : false;
  return (
    <div>
      <PoptavkySubNav canWrite={writer} />
      {children}
    </div>
  );
}
