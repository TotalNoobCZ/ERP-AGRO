// Tiskový export plánu Konstrukce: projekty s úkoly + přehled podle člena.
import { createClient } from "@/lib/supabase/server";
import { nactiKonstrukci } from "@/lib/konstrukce-query";
import { PrintButton } from "@/components/PrintButton";
import { formatDate, formatDen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KonstrukcePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ print?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { clenove, projekty, ukoly } = await nactiKonstrukci(supabase);

  const clenById = new Map(clenove.map((c) => [c.id, c.name]));
  const ukolyProjektu = (pid: string) =>
    ukoly.filter((u) => u.projectId === pid).sort((a, b) => a.name.localeCompare(b.name, "cs"));
  const ukolyClena = (cid: string) =>
    ukoly.filter((u) => u.assigneeId === cid && !u.completed).sort((a, b) => (a.orderInMember ?? 0) - (b.orderInMember ?? 0));

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black">
      <PrintButton auto={sp?.print === "1"} />
      <div className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold">Konstrukce – plán</h1>
        <p className="text-sm text-gray-500">Vytištěno {formatDate(new Date())}</p>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Projekty a úkoly</h2>
        {projekty.length === 0 && <p className="text-sm text-gray-500">Žádné projekty.</p>}
        <div className="space-y-3">
          {projekty.map((p) => (
            <div key={p.id} className="break-inside-avoid">
              <p className="text-sm font-semibold">
                {p.name} <span className="font-normal text-gray-500">· {p.zakazkaKod}{p.ownerName ? ` · ${p.ownerName}` : ""}</span>
              </p>
              <ul className="ml-4 list-disc text-sm">
                {ukolyProjektu(p.id).map((u) => (
                  <li key={u.id} className={u.completed ? "text-gray-400 line-through" : ""}>
                    {u.name}
                    {u.assigneeId ? ` — ${clenById.get(u.assigneeId) ?? "?"}` : " — nepřiřazeno"}
                    {u.startDate && u.endDate ? ` (${formatDen(u.startDate)} – ${formatDen(u.endDate)})` : ""}
                  </li>
                ))}
                {ukolyProjektu(p.id).length === 0 && <li className="text-gray-400">bez úkolů</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Podle člena týmu</h2>
        <div className="space-y-2">
          {clenove.map((c) => {
            const list = ukolyClena(c.id);
            return (
              <div key={c.id} className="break-inside-avoid text-sm">
                <p className="font-semibold">{c.name}</p>
                {list.length === 0 ? (
                  <p className="ml-4 text-gray-400">žádné aktivní úkoly</p>
                ) : (
                  <ul className="ml-4 list-disc">
                    {list.map((u) => (
                      <li key={u.id}>
                        {u.name} <span className="text-gray-500">· {u.projectName}</span>
                        {u.startDate && u.endDate ? ` (${formatDen(u.startDate)} – ${formatDen(u.endDate)})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
