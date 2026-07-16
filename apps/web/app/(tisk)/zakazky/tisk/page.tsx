// Tiskový export seznamu akcí (stejné filtry jako seznam).
import { createClient } from "@/lib/supabase/server";
import { queryZakazky, type ZakazkaListParams } from "@/lib/zakazky-query";
import { PrintButton } from "@/components/PrintButton";
import { parseDay, formatCz } from "@/lib/zakazky/dates";
import { stavLabel } from "@/lib/zakazky/orders";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ZakazkyPrintPage({
  searchParams,
}: {
  searchParams: Promise<ZakazkaListParams & { print?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const zakazky = await queryZakazky(supabase, params);

  return (
    <div className="mx-auto max-w-5xl bg-white p-8 text-black">
      <PrintButton auto={params.print === "1"} />
      <div className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold">Seznam akcí</h1>
        <p className="text-sm text-gray-500">
          Počet: {zakazky.length} · vytištěno {formatDate(new Date())}
        </p>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-gray-400 text-left">
            <th className="py-1 pr-2">P</th>
            <th className="py-1 pr-2">Číslo zakázky</th>
            <th className="py-1 pr-2">Místo plnění</th>
            <th className="py-1 pr-2">Odpovědná</th>
            <th className="py-1 pr-2">Termín</th>
            <th className="py-1 pr-2">Osob</th>
            <th className="py-1 pr-2">Stav</th>
          </tr>
        </thead>
        <tbody>
          {zakazky.map((z) => (
            <tr key={z.id} className="break-inside-avoid border-b border-gray-200 align-top">
              <td className="py-1 pr-2">P{z.priorita}</td>
              <td className="py-1 pr-2 font-mono">{z.kod}</td>
              <td className="py-1 pr-2">{z.misto_plneni}</td>
              <td className="py-1 pr-2">{z.odpovedna?.name ?? "—"}</td>
              <td className="whitespace-nowrap py-1 pr-2">{formatCz(parseDay(z.konec_aktualni))}</td>
              <td className="py-1 pr-2">{z.prirazeni?.[0]?.count ?? 0}</td>
              <td className="whitespace-nowrap py-1 pr-2">
                {stavLabel({ konecAktualni: parseDay(z.konec_aktualni), stav: z.stav })}
              </td>
            </tr>
          ))}
          {zakazky.length === 0 && (
            <tr><td colSpan={7} className="py-4 text-center text-gray-500">Žádné akce.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
