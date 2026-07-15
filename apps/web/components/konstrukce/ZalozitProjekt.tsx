"use client";
// Založení konstrukčního projektu z detailu zakázky (tok: zakázka → projekt).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { vytvoritProjekt } from "@/app/(erp)/konstrukce/actions";

export function ZalozitProjekt({ zakazkaId }: { zakazkaId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setChyba(null);
    const res = await vytvoritProjekt(zakazkaId, name);
    setBusy(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="grow">
        <label className="label">Rozdělit na další projekt</label>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Název dalšího projektu (Enter založí)"
        />
      </div>
      <button className="btn-primary" type="submit" disabled={busy || !name.trim()}>
        {busy ? "Zakládám…" : "Přidat projekt"}
      </button>
      <p className="w-full text-xs text-text-muted">
        První konstrukční projekt vzniká automaticky se zakázkou (volný, čeká na přidělení).
        Tady ho můžeš rozdělit na víc projektů.
      </p>
      {chyba && <p className="err w-full">{chyba}</p>}
    </form>
  );
}
