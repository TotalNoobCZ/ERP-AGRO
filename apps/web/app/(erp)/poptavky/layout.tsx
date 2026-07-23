import { Suspense } from "react";
import { getCurrentProfile } from "@/lib/supabase/server";
import { guardModul } from "@/lib/pristup";
import { PoptavkySubNav } from "@/components/poptavky/sub-nav";
import { ReminderBanner } from "@/components/poptavky/reminder-banner";
import { canWrite, type Role } from "@erp/core";

/** Layout modulu Poptávky – podnavigace (Dashboard/Poptávky/Objednáno/Zákazníci). */
export default async function PoptavkyLayout({ children }: { children: React.ReactNode }) {
  await guardModul("poptavky");
  const profile = await getCurrentProfile();
  const writer = profile ? canWrite(profile.role as Role) : false;
  return (
    <div>
      <PoptavkySubNav canWrite={writer} />
      <Suspense fallback={null}>
        <ReminderBanner />
      </Suspense>
      {children}
    </div>
  );
}
