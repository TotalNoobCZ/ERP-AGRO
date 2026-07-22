import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { povoleneModulyProProfil } from "@/lib/pristup";
import { Nav } from "@/components/nav";
import type { Role } from "@erp/core";

/**
 * Sdílený layout přihlášené části: ověří profil a vykreslí navigaci modulů.
 * (Route group `(erp)` odpovídá modulům z ERP_datovy_model.md kap. 6 –
 * moduly žijí v podadresářích poptavky/, zakazky/, konstrukce/, sprava/.)
 */
export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  // Přihlášený auth účet bez aktivního profilu = nemá do systému přístup.
  if (!profile) redirect("/login");

  const moduly = await povoleneModulyProProfil(profile);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav
        name={profile.name}
        role={profile.role as Role}
        colorIndex={profile.color_index}
        moduly={moduly}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
