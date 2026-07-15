// Karta Archiv (ZADANI.md kap. 11): splněné/archivované úkoly a projekty,
// Obnovit, Smazat archiv. Archivovaný projekt = jeden sloučený záznam.
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { ArchivList, type ArchivRadek } from "@/components/konstrukce/ArchivList";
import { canWrite, type Role } from "@erp/core";

export const dynamic = "force-dynamic";

export default async function ArchivPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const editable = profile ? canWrite(profile.role as Role) : false;

  const [projektyRes, ukolyRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, archived_at, archivoval:profiles!projects_archived_by_fkey(name), tasks(count)")
      .eq("status", "archived")
      .order("archived_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, name, archived_at, project:projects!inner(id, name, status), archivoval:profiles!tasks_archived_by_fkey(name)")
      .eq("status", "archived")
      .order("archived_at", { ascending: false }),
  ]);

  const projekty = (projektyRes.data ?? []) as unknown as {
    id: string;
    name: string;
    archived_at: string | null;
    archivoval: { name: string } | null;
    tasks: { count: number }[];
  }[];
  const ukoly = (ukolyRes.data ?? []) as unknown as {
    id: string;
    name: string;
    archived_at: string | null;
    project: { id: string; name: string; status: string };
    archivoval: { name: string } | null;
  }[];

  const radky: ArchivRadek[] = [
    // Archivovaný projekt = sloučený záznam včetně svých úkolů.
    ...projekty.map((p) => ({
      typ: "projekt" as const,
      id: p.id,
      nazev: p.name,
      projekt: `${p.tasks?.[0]?.count ?? 0} úkolů`,
      kdo: p.archivoval?.name ?? "?",
      kdy: p.archived_at,
    })),
    // Samostatně archivované úkoly (přes „Vyčistit") – jen ty, jejichž projekt je stále aktivní.
    ...ukoly
      .filter((u) => u.project.status === "active")
      .map((u) => ({
        typ: "ukol" as const,
        id: u.id,
        nazev: u.name,
        projekt: u.project.name,
        kdo: u.archivoval?.name ?? "?",
        kdy: u.archived_at,
      })),
  ].sort((a, b) => (b.kdy ?? "").localeCompare(a.kdy ?? ""));

  return <ArchivList radky={radky} editable={editable} />;
}
