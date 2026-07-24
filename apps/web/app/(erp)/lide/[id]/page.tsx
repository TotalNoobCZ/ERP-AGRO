// Karta zaměstnance – náhled pro všechny přihlášené, úprava jen pro admina.
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ODDELENI_LABELS, ROLE_LABELS, type Oddeleni, type Role } from "@erp/core";
import { userColor } from "@erp/ui";

export const dynamic = "force-dynamic";

function Radek({ popisek, hodnota }: { popisek: string; hodnota: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2">
      <dt className="text-sm text-text-muted">{popisek}</dt>
      <dd className="col-span-2 text-sm">{hodnota || <span className="text-text-muted">—</span>}</dd>
    </div>
  );
}

export default async function KartaZamestnancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentProfile();
  if (!me) notFound();
  const jsemAdmin = me.role === "admin";

  const supabase = await createClient();
  // E-mail a poznámka jsou citlivé (odebrané roli authenticated) – běžný náhled
  // je bez nich; adminovi je doplníme přes service-role klienta.
  const { data: p } = await supabase
    .from("profiles")
    .select("id, name, role, oddeleni, sefkonstrukter, color_index, active, pozice, osobni_cislo")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  let citlive: { email: string | null; poznamka: string | null } = { email: null, poznamka: null };
  if (jsemAdmin) {
    const { data: c } = await createAdminClient()
      .from("profiles")
      .select("email, poznamka")
      .eq("id", id)
      .maybeSingle();
    if (c) citlive = { email: c.email, poznamka: c.poznamka };
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Karta zaměstnance</h1>
        {jsemAdmin && (
          <Link href={`/sprava/${p.id}`} className="btn-primary">
            Upravit
          </Link>
        )}
      </div>

      <div className="card space-y-1 p-6">
        <div className="mb-3 flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-base font-bold"
            style={{ backgroundColor: userColor(p.color_index), color: "#16181b" }}
          >
            {p.name.trim().charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-semibold">{p.name}</p>
            {!p.active && <p className="text-xs text-red-500">Neaktivní</p>}
          </div>
        </div>

        <dl className="divide-y divide-line">
          <Radek popisek="Oddělení" hodnota={p.oddeleni ? ODDELENI_LABELS[p.oddeleni as Oddeleni] : ""} />
          <Radek popisek="Pozice" hodnota={p.pozice} />
          {p.oddeleni === "konstrukce" && p.sefkonstrukter && (
            <Radek popisek="Role v konstrukci" hodnota="Šéfkonstruktér" />
          )}
          <Radek popisek="Osobní číslo" hodnota={p.osobni_cislo} />
          {jsemAdmin && <Radek popisek="E-mail" hodnota={citlive.email} />}
          {jsemAdmin && <Radek popisek="Oprávnění" hodnota={ROLE_LABELS[p.role as Role]} />}
          {jsemAdmin && <Radek popisek="Poznámka" hodnota={citlive.poznamka} />}
        </dl>
      </div>

      {!jsemAdmin && (
        <p className="text-xs text-text-muted">Náhled. Úpravu profilu provádí administrátor.</p>
      )}
    </div>
  );
}
