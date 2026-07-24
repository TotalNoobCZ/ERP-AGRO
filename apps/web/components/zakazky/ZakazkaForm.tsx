"use client";
// Formulář nové akce + kolizní dialog s náhradníky
// (port ZakazkaForm z Planovani; useFormState → useActionState /React 19/).
// Nové: volitelné předvyplnění z poptávky (inquiry) – zakázka se propojí
// s poptávkou a zdědí zákazníka.
import { useState, useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { vytvoritZakazku, type ZakazkaStav } from "@/app/(erp)/zakazky/actions";
import { OsobaSelect, type OsobaLite } from "./common";
import { KolizeDialog } from "./KolizeDialog";
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
  odpovedni,
  inquiry,
  parent,
}: {
  osoby: OsobaLite[];
  odpovedni: OsobaLite[]; // odpovědná osoba = Projekťák / role Vedoucí (ne Kancelář)
  inquiry?: InquiryOrigin | null;
  parent?: { id: string; kod: string } | null; // hlavní akce (zakládám podzakázku)
}) {
  const [stav, formAction] = useActionState<ZakazkaStav, FormData>(vytvoritZakazku, {});
  // Řízená pole – aby se po neúspěšném odeslání (React 19 resetuje formulář
  // se server akcí) zadané údaje nesmazaly.
  const [kod, setKod] = useState(inquiry?.subject ?? "");
  const [mistoPlneni, setMistoPlneni] = useState("");
  const [priorita, setPriorita] = useState("3");
  const [poznamka, setPoznamka] = useState("");
  const [zacatek, setZacatek] = useState("");
  const [konec, setKonec] = useState("");
  const [odpovedny, setOdpovedny] = useState("");
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

        {/* Zakládám podzakázku pod hlavní akcí */}
        {parent && (
          <div className="rounded-md border border-link/40 bg-user-0/10 p-3 text-sm">
            Zakázka k akci{" "}
            <Link href={`/zakazky/${parent.id}`} className="font-mono font-medium text-link hover:underline">
              {parent.kod}
            </Link>
            <input type="hidden" name="parentId" value={parent.id} />
          </div>
        )}

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
            <label className="label">Název akce *</label>
            {/* Z poptávky předvyplníme názvem poptávky – lze změnit. */}
            <input name="kod" className="field" required value={kod} onChange={(e) => setKod(e.target.value)} />
            {ch.kod && <p className="err">{ch.kod}</p>}
          </div>
          <div>
            <label className="label">Priorita</label>
            <select name="priorita" className="field" value={priorita} onChange={(e) => setPriorita(e.target.value)}>
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
          <label className="label">Místo plnění *</label>
          <input name="mistoPlneni" className="field" required value={mistoPlneni} onChange={(e) => setMistoPlneni(e.target.value)} />
          {ch.mistoPlneni && <p className="err">{ch.mistoPlneni}</p>}
        </div>

        {/* Odpovědná osoba se určuje jen u hlavní akce; podzakázky ji dědí. */}
        {parent ? (
          <p className="rounded-md border border-line bg-muted/30 p-2 text-xs text-text-muted">
            Odpovědná osoba se řeší u hlavní akce{" "}
            <span className="font-mono">{parent.kod}</span> a platí i pro tuto podzakázku.
          </p>
        ) : (
          <div>
            <label className="label">Odpovědná osoba</label>
            <OsobaSelect osoby={odpovedni} value={odpovedny} onChange={setOdpovedny} name="odpovednaOsobaId" />
            <p className="mt-1 text-xs text-text-muted">
              Nepovinné. Vybírá se z Projekťáků nebo lidí s rolí Vedoucí (ne Kancelář). Platí pro celou akci včetně podzakázek.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Začátek akce *</label>
            <DateField name="zacatek" value={zacatek} onChange={setZacatek} required />
            {ch.zacatek && <p className="err">{ch.zacatek}</p>}
          </div>
          <div>
            <label className="label">Konec akce *</label>
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
            Nepovinné – pracovníky můžeš přiřadit i později (např. na Tabuli zakázek).
            Pracovník je automaticky na akci po celou dobu jejího trvání; pokud má být jinak,
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
          <textarea name="poznamka" className="field" rows={2} value={poznamka} onChange={(e) => setPoznamka(e.target.value)} />
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
