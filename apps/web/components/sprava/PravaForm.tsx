"use client";
// Plošné nastavení přístupu k modulům dle oddělení (matice oddělení × modul).
import { Fragment, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ODDELENI,
  ODDELENI_LABELS,
  KAPITOLY,
  KAPITOLA_LABELS,
  ODDELENI_KAPITOLA,
  MODULY,
  MODUL_LABELS,
  type Modul,
  type Oddeleni,
} from "@erp/core";
import type { ProfilStav } from "@/app/(erp)/sprava/actions";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" type="submit" disabled={pending}>
      {pending ? "Ukládám…" : "Uložit práva"}
    </button>
  );
}

export function PravaForm({
  akce,
  initial,
}: {
  akce: (prev: ProfilStav, fd: FormData) => Promise<ProfilStav>;
  /** oddeleni → povolené moduly */
  initial: Record<string, string[]>;
}) {
  const router = useRouter();
  const [stav, formAction] = useActionState<ProfilStav, FormData>(
    async (prev, fd) => {
      const res = await akce(prev, fd);
      if (res.ok) router.refresh();
      return res;
    },
    {},
  );

  // Řízený stav matice, aby zaškrtnutí přežilo odeslání.
  const [matice, setMatice] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    for (const o of ODDELENI) m[o] = initial[o] ?? [];
    return m;
  });
  const prepnout = (odd: string, modul: Modul) =>
    setMatice((prev) => {
      const cur = prev[odd] ?? [];
      return { ...prev, [odd]: cur.includes(modul) ? cur.filter((x) => x !== modul) : [...cur, modul] };
    });

  return (
    <form action={formAction} className="card space-y-4 p-6">
      {stav.obecna && <p className="err">{stav.obecna}</p>}
      {stav.ok && <p className="text-sm text-green-500">Uloženo.</p>}

      <p className="text-sm text-text-muted">
        Zaškrtni, které moduly vidí jednotlivá oddělení. Toto je výchozí nastavení –
        u konkrétního zaměstnance ho lze v jeho profilu přepsat. Administrátor vidí vždy vše.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 pr-4">Oddělení</th>
              {MODULY.map((m) => (
                <th key={m} className="px-3 py-2 text-center">{MODUL_LABELS[m]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KAPITOLY.map((kap) => (
              <Fragment key={kap}>
                <tr className="bg-accent/40">
                  <td colSpan={MODULY.length + 1} className="px-1 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {KAPITOLA_LABELS[kap]}
                  </td>
                </tr>
                {ODDELENI.filter((o) => ODDELENI_KAPITOLA[o as Oddeleni] === kap).map((odd) => (
                  <tr key={odd} className="border-b border-line/60">
                    <td className="py-2 pr-4">{ODDELENI_LABELS[odd as Oddeleni]}</td>
                    {MODULY.map((m) => (
                      <td key={m} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          name={`mod:${odd}`}
                          value={m}
                          checked={(matice[odd] ?? []).includes(m)}
                          onChange={() => prepnout(odd, m)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 pt-2">
        <Btn />
        <Link href="/sprava" className="btn-ghost">Zpět</Link>
      </div>
    </form>
  );
}
