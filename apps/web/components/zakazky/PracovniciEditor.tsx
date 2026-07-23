"use client";
// Správa pracovníků u existující akce (port z Planovani, jména = profiles.name).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OsobaSelect, type OsobaLite } from "./common";
import { DateField } from "@/components/DateField";
import {
  pridatPracovnika,
  odebratPracovnika,
  zmenitTerminPracovnika,
  nahraditPracovnika,
  type PracVysledek,
} from "@/app/(erp)/zakazky/actions";

type Prac = { id: string; osobaId: string; jmeno: string; od: string; do: string; jeKonstrukter: boolean };
type Typ = "termin" | "nahradit" | "odebrat";

export default function PracovniciEditor({
  zakazkaId,
  prirazeni,
  pracovnici,
  konecAkce,
  dnes,
  muzeOdebratKonstruktera,
}: {
  zakazkaId: string;
  prirazeni: Prac[];
  pracovnici: OsobaLite[];
  konecAkce: string;
  dnes: string;
  /** smí přihlášený odebrat konstruktéra ze zakázky (šéfkonstruktér / admin) */
  muzeOdebratKonstruktera: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const [addOsoba, setAddOsoba] = useState("");
  const [addOd, setAddOd] = useState(dnes);
  const [addDo, setAddDo] = useState(konecAkce);
  const [addDuvod, setAddDuvod] = useState("");

  const [open, setOpen] = useState<{ id: string; typ: Typ } | null>(null);
  const [rOd, setROd] = useState("");
  const [rDo, setRDo] = useState("");
  const [rOsoba, setROsoba] = useState("");
  const [rDuvod, setRDuvod] = useState("");

  async function volat(call: (vynutit: boolean) => Promise<PracVysledek>, onOk: () => void) {
    setChyba(null);
    setBusy(true);
    let res = await call(false);
    if (!res.ok && res.potrebaPotvrzeni) {
      if (window.confirm(res.potrebaPotvrzeni)) res = await call(true);
      else {
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    if (!res.ok) return setChyba(res.chyba ?? "Chyba.");
    onOk();
    router.refresh();
  }

  function otevri(p: Prac, typ: Typ) {
    setChyba(null);
    setOpen({ id: p.id, typ });
    setROd(p.od);
    setRDo(p.do);
    setROsoba("");
    setRDuvod("");
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Pracovníci</h2>
      {chyba && <p className="err mb-2">{chyba}</p>}

      <div className="divide-y divide-line rounded-md border border-line">
        {prirazeni.length === 0 && <p className="px-3 py-2 text-sm text-text-muted">Žádní pracovníci.</p>}
        {prirazeni.map((p) => (
          <div key={p.id} className="px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{p.jmeno}</span>
              <span className="text-text-muted">{p.od} – {p.do}</span>
              <span className="ml-auto flex gap-2">
                <button type="button" className="text-link hover:underline" onClick={() => otevri(p, "termin")}>Termín</button>
                <button type="button" className="text-link hover:underline" onClick={() => otevri(p, "nahradit")}>Nahradit</button>
                {p.jeKonstrukter && !muzeOdebratKonstruktera ? (
                  <span className="text-text-muted" data-tip="Konstruktéra smí odebrat jen šéfkonstruktér nebo administrátor">
                    Odebrat 🔒
                  </span>
                ) : (
                  <button type="button" className="text-red-500 hover:underline" onClick={() => otevri(p, "odebrat")}>Odebrat</button>
                )}
              </span>
            </div>

            {open?.id === p.id && (
              <div className="mt-2 space-y-2 rounded-md bg-muted p-3">
                {open.typ === "termin" && (
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="label">Od</label>
                      <DateField value={rOd} onChange={setROd} />
                    </div>
                    <div>
                      <label className="label">Do</label>
                      <DateField value={rDo} onChange={setRDo} />
                    </div>
                  </div>
                )}
                {open.typ === "nahradit" && (
                  <div>
                    <label className="label">Nahradit osobou</label>
                    <OsobaSelect osoby={pracovnici.filter((o) => o.id !== p.osobaId)} value={rOsoba} onChange={setROsoba} name="_nahrada" />
                  </div>
                )}
                <div>
                  <label className="label">Důvod (povinný)</label>
                  <input className="field" value={rDuvod} onChange={(e) => setRDuvod(e.target.value)} placeholder="Proč se mění" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={open.typ === "odebrat" ? "btn-danger" : "btn-primary"}
                    disabled={busy || rDuvod.trim().length < 3 || (open.typ === "nahradit" && !rOsoba)}
                    onClick={() => {
                      if (open.typ === "termin") volat((v) => zmenitTerminPracovnika(p.id, rOd, rDo, rDuvod, v), () => setOpen(null));
                      else if (open.typ === "nahradit") volat((v) => nahraditPracovnika(p.id, rOsoba, rDuvod, v), () => setOpen(null));
                      else volat(() => odebratPracovnika(p.id, rDuvod), () => setOpen(null));
                    }}
                  >
                    {busy ? "Ukládám…" : open.typ === "odebrat" ? "Odebrat" : "Uložit"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>Zrušit</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Přidat pracovníka */}
      <div className="mt-3 space-y-2 rounded-md border border-line p-3">
        <p className="text-sm font-medium text-text-muted">Přidat pracovníka</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <OsobaSelect osoby={pracovnici} value={addOsoba} onChange={setAddOsoba} name="_pridat" />
          <DateField value={addOd} onChange={setAddOd} />
          <DateField value={addDo} onChange={setAddDo} />
        </div>
        <input className="field" value={addDuvod} onChange={(e) => setAddDuvod(e.target.value)} placeholder="Důvod (povinný)" />
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !addOsoba || addDuvod.trim().length < 3}
          onClick={() =>
            volat(
              (v) => pridatPracovnika(zakazkaId, addOsoba, addOd, addDo, addDuvod, v),
              () => {
                setAddOsoba("");
                setAddDuvod("");
                setAddOd(dnes);
                setAddDo(konecAkce);
              },
            )
          }
        >
          {busy ? "Ukládám…" : "Přidat pracovníka"}
        </button>
      </div>
    </section>
  );
}
