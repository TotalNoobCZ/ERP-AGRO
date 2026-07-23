"use client";
// Editor výrobních fází a uskladnění jedné zakázky (modul Dílna).
// Mistr zadává termíny od–do jednotlivých fází a místo uskladnění.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/DateField";
import { Button } from "@/components/ui";
import { DILNA_FAZE, DILNA_FAZE_LABELS, DILNA_FAZE_BARVY, type DilnaFaze } from "@erp/core";
import { ulozitFazi, ulozitUlozeni, ulozitTermin } from "@/app/(erp)/dilna/actions";
import type { DilnaZakazka } from "@/lib/dilna-query";

type FazeStav = { od: string; do: string };

const den = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

export function DilnaZakazkaEditor({ zakazka, editable }: { zakazka: DilnaZakazka; editable: boolean }) {
  const router = useRouter();
  const [zacatek, setZacatek] = useState(den(zakazka.zacatek));
  const [konec, setKonec] = useState(den(zakazka.konecAktualni));
  const [ulozeni, setUlozeni] = useState(zakazka.ulozeni ?? "");
  const [faze, setFaze] = useState<Record<DilnaFaze, FazeStav>>(() => {
    const init = {} as Record<DilnaFaze, FazeStav>;
    for (const t of DILNA_FAZE) {
      init[t] = { od: zakazka.faze[t]?.datumOd ?? "", do: zakazka.faze[t]?.datumDo ?? "" };
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [chyba, setChyba] = useState("");
  const [ulozeno, setUlozeno] = useState(false);

  function setFazeVal(t: DilnaFaze, klic: "od" | "do", val: string) {
    setUlozeno(false);
    setFaze((prev) => ({ ...prev, [t]: { ...prev[t], [klic]: val } }));
  }

  async function ulozit() {
    setSaving(true);
    setChyba("");
    // Vlastní termín podzakázky/akce (začátek → konec), pokud se změnil.
    if (den(zakazka.zacatek) !== zacatek || den(zakazka.konecAktualni) !== konec) {
      const res = await ulozitTermin(zakazka.id, zacatek, konec);
      if (!res.ok) {
        setChyba(res.chyba);
        setSaving(false);
        return;
      }
    }
    for (const t of DILNA_FAZE) {
      const res = await ulozitFazi(zakazka.id, t, faze[t].od || null, faze[t].do || null);
      if (!res.ok) {
        setChyba(`${DILNA_FAZE_LABELS[t]}: ${res.chyba}`);
        setSaving(false);
        return;
      }
    }
    if ((zakazka.ulozeni ?? "") !== ulozeni) {
      const res = await ulozitUlozeni(zakazka.id, ulozeni);
      if (!res.ok) {
        setChyba(res.chyba);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setUlozeno(true);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href={`/dilna/${zakazka.id}`} className="font-mono font-semibold text-link hover:underline">
            {zakazka.kod}
          </Link>
          {zakazka.parentId && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[11px] text-text-muted">k akci</span>}
          <span className="ml-2 text-sm text-text-muted">{zakazka.popis || zakazka.mistoPlneni}</span>
        </div>
      </div>

      <div className="mb-2 rounded-md border border-line/60 bg-muted/30 p-2">
        <div className="mb-1 text-sm font-medium">Termín {zakazka.parentId ? "podzakázky" : "akce"}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-text-muted">začátek</span>
          <DateField value={zacatek} onChange={(v) => { setZacatek(v); setUlozeno(false); }} className="w-32" />
          <span className="text-text-muted">konec</span>
          <DateField value={konec} onChange={(v) => { setKonec(v); setUlozeno(false); }} className="w-32" />
        </div>
        <p className="mt-1 text-[11px] text-text-muted">
          Podzakázka může mít jiný začátek i konec než akce. Fáze níže jsou jen dílčí milníky uvnitř termínu.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {DILNA_FAZE.map((t) => (
          <div key={t} className="rounded-md border border-line/60 p-2">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DILNA_FAZE_BARVY[t] }} />
              {DILNA_FAZE_LABELS[t]}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-text-muted">od</span>
              <DateField value={faze[t].od} onChange={(v) => setFazeVal(t, "od", v)} className="w-32" />
              <span className="text-text-muted">do</span>
              <DateField value={faze[t].do} onChange={(v) => setFazeVal(t, "do", v)} className="w-32" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <label className="mb-1 block text-xs text-text-muted">Uskladnění (kde je díl / stroj)</label>
        <input
          className="field"
          value={ulozeni}
          onChange={(e) => { setUlozeni(e.target.value); setUlozeno(false); }}
          placeholder="Např. hala B, regál 12 / venkovní sklad…"
        />
      </div>

      {editable && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={ulozit} disabled={saving}>
            {saving ? "Ukládám…" : "Uložit"}
          </Button>
          {ulozeno && <span className="text-xs text-green-600">Uloženo ✓</span>}
          {chyba && <span className="text-xs text-destructive">{chyba}</span>}
        </div>
      )}
    </div>
  );
}
