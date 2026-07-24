"use client";
// Menší formuláře modulu Zakázky – port ZakazkaEditForm, ProdlouzeniForm,
// PreruseniForm, PoznamkyAkce a MilnikyEditor z Planovani
// (useFormState → useActionState, jména = profiles.name).
import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ZakazkaStav } from "@/app/(erp)/zakazky/actions";
import {
  pridatMilnik,
  upravitMilnik,
  smazatMilnik,
  pridatPoznamku,
  smazatPoznamku,
} from "@/app/(erp)/zakazky/actions";
import { MILNIK_LABELS, MILNIK_TYPY, type TypMilniku } from "@erp/core";
import { OsobaSelect, type OsobaLite } from "./common";
import { DateField } from "@/components/DateField";

function Btn({ label = "Uložit" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" type="submit" disabled={pending}>
      {pending ? "Ukládám…" : label}
    </button>
  );
}

// ---------- Úprava akce ----------
type Init = {
  id: string;
  kod: string;
  mistoPlneni: string;
  priorita: number;
  zacatek: string;
  poznamka: string | null;
  odpovednaOsobaId: string | null;
};

export function ZakazkaEditForm({
  akce,
  zakazka,
  osoby,
  jePodzakazka = false,
}: {
  akce: (prev: ZakazkaStav, fd: FormData) => Promise<ZakazkaStav>;
  zakazka: Init;
  osoby: OsobaLite[];
  /** Podzakázka – odpovědná osoba se řeší u hlavní akce, tady se skryje. */
  jePodzakazka?: boolean;
}) {
  const [stav, formAction] = useActionState<ZakazkaStav, FormData>(akce, {});
  const [odpovedny, setOdpovedny] = useState(zakazka.odpovednaOsobaId ?? "");
  const [zacatek, setZacatek] = useState(zakazka.zacatek);
  // Řízená pole – aby se po neúspěšném uložení zadané údaje nesmazaly (React 19).
  const [kod, setKod] = useState(zakazka.kod);
  const [priorita, setPriorita] = useState(String(zakazka.priorita));
  const [mistoPlneni, setMistoPlneni] = useState(zakazka.mistoPlneni);
  const [poznamka, setPoznamka] = useState(zakazka.poznamka ?? "");
  const ch = stav.chyby ?? {};

  return (
    <form action={formAction} className="card max-w-2xl space-y-4 p-6">
      {stav.obecna && <p className="err">{stav.obecna}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Název akce *</label>
          <input name="kod" className="field" value={kod} onChange={(e) => setKod(e.target.value)} required />
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
        </div>
      </div>

      <div>
        <label className="label">Místo plnění *</label>
        <input name="mistoPlneni" className="field" value={mistoPlneni} onChange={(e) => setMistoPlneni(e.target.value)} required />
        {ch.mistoPlneni && <p className="err">{ch.mistoPlneni}</p>}
      </div>

      {/* Odpovědná osoba jen u hlavní akce; podzakázka ji dědí. */}
      {jePodzakazka ? (
        <p className="rounded-md border border-line bg-muted/30 p-2 text-xs text-text-muted">
          Odpovědná osoba se řeší u hlavní akce a platí i pro tuto podzakázku.
        </p>
      ) : (
        <div>
          <label className="label">Odpovědná osoba</label>
          <OsobaSelect osoby={osoby} value={odpovedny} onChange={setOdpovedny} name="odpovednaOsobaId" />
          <p className="mt-1 text-xs text-text-muted">
            Nepovinné. Vybírá se z Kanceláře, Projekťáků nebo lidí s rolí Vedoucí. Platí pro celou akci včetně podzakázek.
          </p>
        </div>
      )}

      <div>
        <label className="label">Začátek akce *</label>
        <DateField name="zacatek" value={zacatek} onChange={setZacatek} required />
        {ch.zacatek && <p className="err">{ch.zacatek}</p>}
        <p className="mt-1 text-xs text-text-muted">
          Termín konce se mění přes „Změna termínu“ na detailu akce (kvůli historii a důvodu).
        </p>
      </div>

      <div>
        <label className="label">Poznámka</label>
        <textarea name="poznamka" className="field" rows={2} value={poznamka} onChange={(e) => setPoznamka(e.target.value)} />
      </div>

      <div className="flex gap-3 pt-2">
        <Btn label="Uložit změny" />
        <Link href={`/zakazky/${zakazka.id}`} className="btn-ghost">Zrušit</Link>
      </div>
    </form>
  );
}

// ---------- Prodloužení ----------
export function ProdlouzeniForm({
  akce,
}: {
  akce: (prev: ZakazkaStav, fd: FormData) => Promise<ZakazkaStav>;
}) {
  const [stav, formAction] = useActionState<ZakazkaStav, FormData>(akce, {});
  const [novyKonec, setNovyKonec] = useState("");
  const [duvod, setDuvod] = useState("");
  const ch = stav.chyby ?? {};
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {stav.obecna && <p className="err w-full">{stav.obecna}</p>}
      <div>
        <label className="label">Nový termín konce</label>
        <DateField name="novyKonec" value={novyKonec} onChange={setNovyKonec} required />
        {ch.novyKonec && <p className="err">{ch.novyKonec}</p>}
      </div>
      <div className="grow">
        <label className="label">Důvod (povinný)</label>
        <input name="duvod" className="field" value={duvod} onChange={(e) => setDuvod(e.target.value)} required />
        {ch.duvod && <p className="err">{ch.duvod}</p>}
      </div>
      <Btn label="Uložit termín" />
    </form>
  );
}

// ---------- Přerušení / obnovení ----------
export function PreruseniForm({
  mode,
  akce,
}: {
  mode: "prerusit" | "obnovit";
  akce: (prev: ZakazkaStav, fd: FormData) => Promise<ZakazkaStav>;
}) {
  const [stav, formAction] = useActionState<ZakazkaStav, FormData>(akce, {});
  const [datum, setDatum] = useState("");
  const [duvod, setDuvod] = useState("");
  const ch = stav.chyby ?? {};

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {stav.obecna && <p className="err w-full">{stav.obecna}</p>}
      {mode === "prerusit" ? (
        <>
          <div>
            <label className="label">Datum přerušení</label>
            <DateField name="datumOd" value={datum} onChange={setDatum} required />
            {ch.datumOd && <p className="err">{ch.datumOd}</p>}
          </div>
          <div className="grow">
            <label className="label">Důvod (povinný)</label>
            <input name="duvod" className="field" value={duvod} onChange={(e) => setDuvod(e.target.value)} required />
            {ch.duvod && <p className="err">{ch.duvod}</p>}
          </div>
          <Btn label="Přerušit akci" />
        </>
      ) : (
        <>
          <div>
            <label className="label">Datum obnovení (odtud se dopočítají zbývající dny)</label>
            <DateField name="datumObnoveni" value={datum} onChange={setDatum} required />
            {ch.datumObnoveni && <p className="err">{ch.datumObnoveni}</p>}
          </div>
          <Btn label="Obnovit akci" />
        </>
      )}
    </form>
  );
}

// ---------- Poznámky ----------
type Poznamka = { id: string; text: string; autor: string; kdy: string; muzeSmazat: boolean };

export function PoznamkyAkce({ zakazkaId, poznamky }: { zakazkaId: string; poznamky: Poznamka[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function pridat() {
    setChyba(null);
    setBusy(true);
    const res = await pridatPoznamku(zakazkaId, text);
    setBusy(false);
    if (!res.ok) return setChyba(res.chyba ?? "Chyba.");
    setText("");
    router.refresh();
  }
  async function smazat(id: string) {
    if (!window.confirm("Smazat poznámku?")) return;
    setBusy(true);
    await smazatPoznamku(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      {chyba && <p className="err mb-2">{chyba}</p>}

      <div className="card divide-y divide-line">
        {poznamky.length === 0 && <p className="px-4 py-3 text-sm text-text-muted">Zatím žádné poznámky.</p>}
        {poznamky.map((p) => (
          <div key={p.id} className="px-4 py-3">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{p.autor} · {p.kdy}</span>
              {p.muzeSmazat && (
                <button type="button" onClick={() => smazat(p.id)} className="text-red-500 hover:underline">
                  Smazat
                </button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{p.text}</p>
          </div>
        ))}
      </div>

      <div className="card mt-3 space-y-2 p-4">
        <textarea className="field" rows={2} placeholder="Nová poznámka…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary" disabled={busy || !text.trim()} onClick={pridat}>
          {busy ? "Ukládám…" : "Přidat poznámku"}
        </button>
      </div>
    </>
  );
}

// ---------- Milníky ----------
const barva = (t: string) => (t.includes("LAKOVANI") ? "text-purple-500" : "text-orange-500");

type Milnik = { id: string; typ: string; datum: string; cas: string | null; poznamka: string | null };
type MilnikFormData = { typ: string; datum: string; cas: string; poznamka: string };

const PRAZDNY: MilnikFormData = { typ: "ZAHAJENI_VYROBY", datum: "", cas: "", poznamka: "" };

// Mimo hlavní komponentu, aby pole při psaní neztrácela fokus.
function PoleMilniku({ f, set }: { f: MilnikFormData; set: (f: MilnikFormData) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <select className="field" value={f.typ} onChange={(e) => set({ ...f, typ: e.target.value })}>
        {MILNIK_TYPY.map((t) => (
          <option key={t} value={t}>{MILNIK_LABELS[t as TypMilniku]}</option>
        ))}
      </select>
      <DateField value={f.datum} onChange={(v) => set({ ...f, datum: v })} />
      <input type="time" className="field" value={f.cas} onChange={(e) => set({ ...f, cas: e.target.value })} />
      <input className="field" placeholder="Poznámka" value={f.poznamka} onChange={(e) => set({ ...f, poznamka: e.target.value })} />
    </div>
  );
}

export function MilnikyEditor({ zakazkaId, milniky }: { zakazkaId: string; milniky: Milnik[] }) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [novy, setNovy] = useState<MilnikFormData>(PRAZDNY);
  const [edit, setEdit] = useState<MilnikFormData>(PRAZDNY);

  async function pridat() {
    setChyba(null);
    setBusy(true);
    const res = await pridatMilnik(zakazkaId, novy);
    setBusy(false);
    if (!res.ok) return setChyba(res.chyba ?? "Chyba.");
    setNovy(PRAZDNY);
    router.refresh();
  }
  function zacitUpravu(m: Milnik) {
    setChyba(null);
    setEditId(m.id);
    setEdit({ typ: m.typ, datum: m.datum, cas: m.cas ?? "", poznamka: m.poznamka ?? "" });
  }
  async function ulozitUpravu(id: string) {
    setChyba(null);
    setBusy(true);
    const res = await upravitMilnik(id, edit);
    setBusy(false);
    if (!res.ok) return setChyba(res.chyba ?? "Chyba.");
    setEditId(null);
    router.refresh();
  }
  async function smazat(id: string) {
    if (!window.confirm("Smazat tento milník?")) return;
    setBusy(true);
    await smazatMilnik(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      {chyba && <p className="err mb-2">{chyba}</p>}

      <div className="card divide-y divide-line">
        {milniky.length === 0 && <p className="px-4 py-3 text-sm text-text-muted">Zatím žádné milníky.</p>}

        {milniky.map((m) =>
          editId === m.id ? (
            <div key={m.id} className="space-y-2 px-4 py-3">
              <PoleMilniku f={edit} set={setEdit} />
              <div className="flex gap-2">
                <button className="btn-primary" disabled={busy} onClick={() => ulozitUpravu(m.id)}>
                  {busy ? "Ukládám…" : "Uložit"}
                </button>
                <button className="btn-ghost" onClick={() => setEditId(null)}>Zrušit</button>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className={`font-medium ${barva(m.typ)}`}>{MILNIK_LABELS[m.typ as TypMilniku] ?? m.typ}</span>
              <span className="text-text-muted">{m.datum}{m.cas ? ` ${m.cas}` : ""}</span>
              {m.poznamka && <span className="text-text-muted">— {m.poznamka}</span>}
              <span className="ml-auto flex gap-2">
                <button className="text-link hover:underline" onClick={() => zacitUpravu(m)}>Upravit</button>
                <button className="text-red-500 hover:underline" onClick={() => smazat(m.id)}>Smazat</button>
              </span>
            </div>
          ),
        )}
      </div>

      <div className="card mt-3 space-y-2 p-4">
        <p className="text-sm font-medium text-text-muted">Přidat milník</p>
        <PoleMilniku f={novy} set={setNovy} />
        <button className="btn-primary" disabled={busy || !novy.datum} onClick={pridat}>
          {busy ? "Přidávám…" : "Přidat milník"}
        </button>
      </div>
    </>
  );
}
