"use client";
// Inline lišta pro rychlé založení podzakázky (Číslo zakázky + Popis).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { vytvoritPodzakazku } from "@/app/(erp)/zakazky/actions";

export function ZalozitPodzakazku({ parentId }: { parentId: string }) {
  const router = useRouter();
  const [cislo, setCislo] = useState("");
  const [popis, setPopis] = useState("");
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cislo.trim()) return;
    setBusy(true);
    setChyba(null);
    const res = await vytvoritPodzakazku(parentId, cislo, popis);
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setCislo("");
    setPopis("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="w-44">
        <label className="label">Číslo zakázky</label>
        <input
          className="field"
          value={cislo}
          onChange={(e) => setCislo(e.target.value)}
          placeholder="např. 2024-001-A"
        />
      </div>
      <div className="grow">
        <label className="label">Popis (oč se jedná)</label>
        <input
          className="field"
          value={popis}
          onChange={(e) => setPopis(e.target.value)}
          placeholder="krátký popis podzakázky"
        />
      </div>
      <button className="btn-primary" type="submit" disabled={busy || !cislo.trim()}>
        {busy ? "Zakládám…" : "Přidat podzakázku"}
      </button>
      {chyba && <p className="err w-full">{chyba}</p>}
    </form>
  );
}
