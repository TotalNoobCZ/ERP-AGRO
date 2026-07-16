"use client";
// Formulář nové akce + kolizní dialog s náhradníky
// (port ZakazkaForm z Planovani; useFormState → useActionState /React 19/).
// Nové: volitelné předvyplnění z poptávky (inquiry) – zakázka se propojí
// s poptávkou a zdědí zákazníka.
import { useState, useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { vytvoritZakazku, vyresitKolizi, type ZakazkaStav, type KolizeInfo } from "@/app/(erp)/zakazky/actions";
import { OsobaSelect, type OsobaLite } from "./common";
import { formatDen } from "@/lib/format";
import { DateField } from "@/components/DateField";

type Radek = { key: number; osobaId: string; vyjimka: boolean; od: string; do: string };

export type InquiryOrigin = {
  id: string;
  number: number;
  subject: string;
  customerId: string | null;
  customerName: string | null;
};

function Ulozit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" type="submit" disabled={pending}>
      {pending ? "Ukládám…" : "Vytvořit akci"}
    </button>
  );
}

export default function ZakazkaForm({
  osoby,
  inquiry,
}: {
  osoby: OsobaLite[];
  inquiry?: InquiryOrigin | null;
}) {
  const [stav, formAction] = useActionState<ZakazkaStav, FormData>(vytvoritZakazku, {});
  const [zacatek, setZacatek] = useState("");
  const [konec, setKonec] = useState("");
  const [odpovedny, setOdpovedny] = useState("");
  // Odpovědná osoba akce = Kancelář nebo Projekťák.
  const kancelar = osoby.filter((o) => o.oddeleni === "kancelar" || o.oddeleni === "projektak");
  const [radky, setRadky] = useState<Radek[]>([{ key: 1, osobaId: "", vyjimka: false, od: "", do: "" }]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const ch = stav.chyby ?? {};

  useEffect(() => {
    if (stav.kolize && stav.kolize.length > 0) setDialogOpen(true);
  }, [stav]);

  function pridat() {
    setRadky((r) => [...r, { key: Date.now(), osobaId: "", vyjimka: false, od: "", do: "" }]);
  }
  function odebrat(key: number) {
    setRadky((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));
  }
  function zmenit(key: number, patch: Partial<Radek>) {
    setRadky((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  return (
    <>
      <form action={formAction} className="card max-w-2xl space-y-4 p-6">
        {stav.obecna && <p className="err">{stav.obecna}</p>}

        {/* Původ z poptávky – propojení modulů */}
        {inquiry && (
          <div className="rounded-md border border-link/40 bg-user-0/10 p-3 text-sm">
            Zakázka vznikne z poptávky{" "}
            <Link href={`/poptavky/${inquiry.id}`} className="font-medium text-link hover:underline">
              #{inquiry.number} · {inquiry.subject}
            </Link>
            {inquiry.customerName && (
              <> — zákazník <strong>{inquiry.customerName}</strong> se zdědí.</>
            )}
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <input type="hidden" name="customerId" value={inquiry.customerId ?? ""} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Číslo zakázky</label>
            <input name="kod" className="field" required />
            {ch.kod && <p className="err">{ch.kod}</p>}
          </div>
          <div>
            <label className="label">Priorita</label>
            <select name="priorita" className="field" defaultValue="3">
              <option value={1}>1 – nejvyšší</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5 – nejnižší</option>
            </select>
            <p className="mt-1 text-xs text-text-muted">1 = nejvyšší priorita, 5 = nejnižší</p>
          </div>
        </div>

        <div>
          <label className="label">Místo plnění</label>
          <input name="mistoPlneni" className="field" required />
          {ch.mistoPlneni && <p className="err">{ch.mistoPlneni}</p>}
        </div>

        <div>
          <label className="label">Odpovědná osoba (kancelář / projekťák)</label>
          <OsobaSelect osoby={kancelar} value={odpovedny} onChange={setOdpovedny} name="odpovednaOsobaId" />
          <p className="mt-1 text-xs text-text-muted">Nepovinné. Vybírá se z lidí v Kanceláři.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Začátek akce</label>
            <DateField name="zacatek" value={zacatek} onChange={setZacatek} required />
            {ch.zacatek && <p className="err">{ch.zacatek}</p>}
          </div>
          <div>
            <label className="label">Konec akce</label>
            <DateField name="konec" value={konec} onChange={setKonec} required />
            {ch.konec && <p className="err">{ch.konec}</p>}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">Přiřazení pracovníci</label>
            <button type="button" onClick={pridat} className="btn-ghost px-2 py-1 text-sm">+ Přidat</button>
          </div>
          <p className="mb-2 text-xs text-text-muted">
            Pracovník je automaticky na akci po celou dobu jejího trvání. Pokud má být jinak,
            zaškrtni „Jiné termíny“ a zadej vlastní období.
          </p>
          {ch.prirazeni && <p className="err">{ch.prirazeni}</p>}
          <div className="space-y-3">
            {radky.map((r) => (
              <div key={r.key} className="rounded-md border border-line p-3">
                <div className="flex items-center gap-2">
                  <OsobaSelect osoby={osoby} value={r.osobaId} onChange={(id) => zmenit(r.key, { osobaId: id })} />
                  <button
                    type="button"
                    onClick={() => odebrat(r.key)}
                    className="px-2 text-text-muted hover:text-red-500"
                    aria-label="Odebrat"
                  >
                    ×
                  </button>
                </div>

                <label className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                  <input type="checkbox" checked={r.vyjimka} onChange={(e) => zmenit(r.key, { vyjimka: e.target.checked })} />
                  Jiné termíny (výjimka)
                </label>

                {r.vyjimka && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <DateField value={r.od} onChange={(v) => zmenit(r.key, { od: v })} />
                    <DateField value={r.do} onChange={(v) => zmenit(r.key, { do: v })} />
                  </div>
                )}

                <input type="hidden" name="prir_od" value={r.vyjimka ? r.od : zacatek} readOnly />
                <input type="hidden" name="prir_do" value={r.vyjimka ? r.do : konec} readOnly />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Poznámka</label>
          <textarea name="poznamka" className="field" rows={2} />
        </div>

        <div className="flex gap-3 pt-2">
          <Ulozit />
          <Link href="/zakazky" className="btn-ghost">Zrušit</Link>
        </div>
      </form>

      {dialogOpen && stav.kolize && stav.kolize.length > 0 && (
        <KolizeDialog kolize={stav.kolize} osoby={osoby} onClose={() => setDialogOpen(false)} />
      )}
    </>
  );
}

function KolizeDialog({
  kolize,
  osoby,
  onClose,
}: {
  kolize: KolizeInfo[];
  osoby: OsobaLite[];
  onClose: () => void;
}) {
  const [vyreseno, setVyreseno] = useState<Record<string, boolean>>({});
  const vseVyreseno = kolize.every((k) => vyreseno[k.prirazeniId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-h-[85vh] w-full max-w-lg overflow-auto p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-red-500">Kolize v přiřazení</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Zavřít">✕</button>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Akci nelze uložit, dokud kolize nevyřešíte. Postup: stávající akce se člověku
          <strong> rozdělí kolem nového období</strong> (části před a po mu zůstanou) a na
          překryv se na stávající akci dosadí náhradník. Nemáte-li náhradníka, okno zavřete
          a upravte termíny nebo osobu.
        </p>

        <div className="mt-4 space-y-4">
          {kolize.map((k) => (
            <div key={k.prirazeniId} className="rounded-md border border-line p-3">
              <p className="text-sm">
                <strong>{k.osobaJmeno}</strong> už je v období {formatDen(k.od)} – {formatDen(k.do)} na akci{" "}
                <span className="font-mono">{k.zakazkaKod}</span>.
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Na akci <span className="font-mono">{k.zakazkaKod}</span>{" "}
                {k.predOd || k.poOd ? (
                  <>
                    osobě zůstane{" "}
                    {k.predOd && <strong>{formatDen(k.predOd)} – {formatDen(k.predDo)}</strong>}
                    {k.predOd && k.poOd ? " a " : ""}
                    {k.poOd && <strong>{formatDen(k.poOd)} – {formatDen(k.poDo)}</strong>}
                  </>
                ) : (
                  "osoba už nezůstane (nové období pokrývá celé)"
                )}
                ; na období {formatDen(k.nahradnikOd)} – {formatDen(k.nahradnikDo)} sem dosadíme náhradníka:
              </p>

              {vyreseno[k.prirazeniId] ? (
                <p className="mt-2 text-sm font-medium text-green-500">
                  ✓ Náhradník dosazen na akci {k.zakazkaKod}.
                </p>
              ) : (
                <ResitPolozka
                  kolize={k}
                  osoby={osoby.filter((o) => o.id !== k.osobaId && o.oddeleni !== "kancelar")}
                  onDone={() => setVyreseno((v) => ({ ...v, [k.prirazeniId]: true }))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-xs text-text-muted">
            {vseVyreseno
              ? "Vše vyřešeno. Zavřete okno a klikněte znovu na „Vytvořit akci“."
              : "Vyřešte kolize, nebo okno zavřete a upravte zadání."}
          </span>
          <button type="button" onClick={onClose} className={vseVyreseno ? "btn-primary" : "btn-ghost"}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}

function ResitPolozka({
  kolize,
  osoby,
  onDone,
}: {
  kolize: KolizeInfo;
  osoby: OsobaLite[];
  onDone: () => void;
}) {
  const [nahradnik, setNahradnik] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [nacita, setNacita] = useState(false);

  const obsazenost = new Map<string, { od: string; do: string }>();
  for (const o of kolize.obsazeni) if (!obsazenost.has(o.osobaId)) obsazenost.set(o.osobaId, { od: o.od, do: o.do });
  const volni = osoby.filter((o) => !obsazenost.has(o.id));
  const obsazeni = osoby.filter((o) => obsazenost.has(o.id));

  async function vyresit() {
    const b = obsazenost.get(nahradnik);
    let vynutit = false;
    if (b) {
      const os = osoby.find((o) => o.id === nahradnik);
      const jmeno = os?.name ?? "Tato osoba";
      if (!window.confirm(`${jmeno} je v období ${b.od} – ${b.do} obsazená u jiné akce. Dosadit i tak? Potvrzení se zapíše do historie.`)) return;
      vynutit = true;
    }
    setChyba(null);
    setNacita(true);
    const res = await vyresitKolizi(kolize.prirazeniId, kolize.novyOd, kolize.novyDo, nahradnik, vynutit);
    setNacita(false);
    if (!res.ok) {
      setChyba(res.chyba ?? "Nepovedlo se.");
      return;
    }
    onDone();
  }

  if (osoby.length === 0) {
    return (
      <p className="mt-2 text-sm text-amber-500">
        Není k dispozici žádná osoba (z Dílny/Elektra) jako náhradník. Zavřete okno a upravte
        termíny nebo přiřazenou osobu.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-2">
        <select className="field" value={nahradnik} onChange={(e) => setNahradnik(e.target.value)}>
          <option value="">— vyberte náhradníka —</option>
          {volni.length > 0 && (
            <optgroup label="Volní">
              {volni.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </optgroup>
          )}
          {obsazeni.length > 0 && (
            <optgroup label="Obsazení (nutné potvrzení)">
              {obsazeni.map((o) => {
                const b = obsazenost.get(o.id)!;
                return (
                  <option key={o.id} value={o.id}>
                    {o.name} — obsazen {b.od} – {b.do}
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>
        <button type="button" className="btn-primary whitespace-nowrap" disabled={nacita || !nahradnik} onClick={vyresit}>
          {nacita ? "…" : "Dosadit"}
        </button>
      </div>
      <p className="text-xs text-text-muted">
        Volní jsou nahoře. Obsazeného lze dosadit jen po potvrzení (zapíše se do historie).
      </p>
      {chyba && <p className="err">{chyba}</p>}
    </div>
  );
}
