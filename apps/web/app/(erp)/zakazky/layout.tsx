import { getCurrentProfile } from "@/lib/supabase/server";
import { guardModul } from "@/lib/pristup";
import { ZakazkySubNav } from "@/components/zakazky/sub-nav";
import { canWrite, type Role } from "@erp/core";

/** Layout modulu Zakázky – podnavigace Plán / Akce / Archiv. */
export default async function ZakazkyLayout({ children }: { children: React.ReactNode }) {
  await guardModul("zakazky");
  const profile = await getCurrentProfile();
  const writer = profile ? canWrite(profile.role as Role) : false;
  return (
    <div>
      <ZakazkySubNav canWrite={writer} />
      {children}
    </div>
  );
}
