// Detail akce – port z Planovani/app/(app)/zakazky/[id]/page.tsx.
// Nové (integrace): odkaz na zdrojovou poptávku a zděděného zákazníka.
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { parseDay, formatDay, formatCz, today } from "@/lib/zakazky/dates";
import { formatDateTime } from "@/lib/format";
import { StavBadge, SubmitButton, SmazatButton } from "@/components/zakazky/common";
import {
  prodlouzit,
  zmenitStav,
  smazatZakazku,
  prerusitAkci,
  obnovitAkci,
  type ZakazkaStav,
} from "../actions";
import { ProdlouzeniForm, PreruseniForm, PoznamkyAkce, MilnikyEditor } from "@/components/zakazky/formulare";
import Timeline, { type TRadek } from "@/components/zakazky/Timeline";
import { ZalozitProjekt } from "@/components/konstrukce/ZalozitProjekt";
import { ZalozitPodzakazku } from "@/components/zakazky/ZalozitPodzakazku";
import { nacistLidiZakazek, sjednotitOsoby, type Osoba } from "@/lib/zakazky/lide";
import { userColor } from "@erp/ui";
import type { StavZakazky } from "@erp/core";

export const dynamic = "force-dynamic";

const TYP_ZMENY_LABEL: Record<string, string> = {
  VYTVORENI: "Vytvoření",
  UPRAVA: "Úprava",
  SMAZANI: "Smazání",
  PRODLOUZENI: "Prodloužení",
  ARCHIVACE: "Archivace",
};

type Detail = {
  id: string;
  kod: string;
  misto_plneni: string;
  priorita: number;
  zacatek: string;
  konec_puvodni: string;
  konec_aktualni: string;
  stav: StavZakazky;
  poznamka: string | null;
  deleted_at: string | null;
  parent_id: string | null;
  inquiry: { id: string; number: number; subject: string } | null;
  customer: { id: string; name: string } | null;
  odpovedna: { name: string } | null;
  prirazeni: { id: string; osoba_id: string; datum_od: string; datum_do: string; deleted_at: string | null; osoba: { name: string } | null }[];
  milniky: { id: string; typ: string; datum: string; cas: string | null; poznamka: string | null; deleted_at: string | null }[];
  prodlouzeni: { id: string; stary_konec: string; novy_konec: string; duvod: string; created_at: string; provedl: { name: string } | null }[];
  poznamky: { id: string; text: string; uzivatel_id: string; created_at: string; deleted_at: string | null; uzivatel: { name: string } | null }[];
  preruseni: { id: string; datum_od: string; datum_do: string | null; zbyvajici_dny: number; duvod: string; created_at: string; prerusil: { name: string } | null; obnovil: { name: string } | null }[];
};

export default async function ZakazkaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("zakazky")
    .select(
      `id, kod, misto_plneni, priorita, zacatek, konec_puvodni, konec_aktualni, stav, poznamka, deleted_at, parent_id,
       inquiry:inquiries(id, number, subject),
       customer:customers(id, name),
       odpovedna:profiles!zakazky_odpovedna_osoba_id_fkey(name),
       prirazeni:prirazeni_zakazka(id, osoba_id, datum_od, datum_do, deleted_at, osoba:profiles(name)),
       milniky(id, typ, datum, cas, poznamka, deleted_at),
       prodlouzeni(id, stary_konec, novy_konec, duvod, created_at, provedl:profiles!prodlouzeni_provedl_id_fkey(name)),
       poznamky:akce_poznamky(id, text, uzivatel_id, created_at, deleted_at, uzivatel:profiles(name)),
       preruseni(id, datum_od, datum_do, zbyvajici_dny, duvod, created_at,
         prerusil:profiles!preruseni_prerusil_id_fkey(name),
         obnovil:profiles!preruseni_obnovil_id_fkey(name))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || (data as { deleted_at: string | null }).deleted_at) notFound();
  const z = data as unknown as Detail;

  // Podzakázky (dceřiné) + odkaz na hlavní akci.
  const { data: podzakazkyData } = await supabase
    .from("zakazky")
    .select("id, kod, misto_plneni, popis, stav, konec_aktualni")
    .eq("parent_id", z.id)
    .is("deleted_at", null)
    .order("kod", { ascending: true });
  const podzakazky = (podzakazkyData ?? []) as {
    id: string;
    kod: string;
    misto_plneni: string;
    popis: string | null;
    stav: StavZakazky;
    konec_aktualni: string;
  }[];

  let rodic: { id: string; kod: string } | null = null;
  if (z.parent_id) {
    const { data: p } = await supabase.from("zakazky").select("id, kod").eq("id", z.parent_id).maybeSingle();
    if (p) rodic = { id: p.id, kod: p.kod };
  }

  // Lidé na akci = přiřazení + odpovědní napříč akcí a jejími zakázkami k akci.
  const lidiMap = await nacistLidiZakazek(supabase, [z.id, ...podzakazky.map((p) => p.id)]);
  const lideAkce = sjednotitOsoby([lidiMap.get(z.id), ...podzakazky.map((p) => lidiMap.get(p.id))]);

  const prirazeni = z.prirazeni
    .filter((p) => !p.deleted_at)
    .sort((a, b) => a.datum_od.localeCompare(b.datum_od));
  const milniky = z.milniky
    .filter((m) => !m.deleted_at)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const prodlouzeni = [...z.prodlouzeni].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const preruseni = [...z.preruseni].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const profile = await getCurrentProfile();
  const uid = profile?.id;
  const jeAdmin = profile?.role === "admin";

  const poznamky = z.poznamky
    .filter((p) => !p.deleted_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((p) => ({
      id: p.id,
      text: p.text,
      autor: p.uzivatel?.name ?? "?",
      kdy: formatDateTime(p.created_at),
      muzeSmazat: p.uzivatel_id === uid || Boolean(jeAdmin),
    }));

  const otevrenePreruseni = preruseni.find((p) => p.datum_do === null) ?? null;
  const akcePrerusit = prerusitAkci.bind(null, z.id) as (p: ZakazkaStav, fd: FormData) => Promise<ZakazkaStav>;
  const akceObnovit = obnovitAkci.bind(null, z.id) as (p: ZakazkaStav, fd: FormData) => Promise<ZakazkaStav>;

  const { data: auditData } = await supabase
    .from("audit_log")
    .select("id, typ_zmeny, nova_hodnota, created_at, uzivatel:profiles(name)")
    .eq("entita", "zakazka")
    .eq("entita_id", z.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const audit = (auditData ?? []) as unknown as {
    id: string;
    typ_zmeny: string;
    nova_hodnota: { popis?: string } | null;
    created_at: string;
    uzivatel: { name: string } | null;
  }[];

  const zacatekD = parseDay(z.zacatek);
  const konecPuvodniD = parseDay(z.konec_puvodni);
  const konecAktualniD = parseDay(z.konec_aktualni);
  const prodlouzeno = konecAktualniD.getTime() !== konecPuvodniD.getTime();
  const akceProdlouzit = prodlouzit.bind(null, z.id) as (p: ZakazkaStav, fd: FormData) => Promise<ZakazkaStav>;
  const akceSmazat = smazatZakazku.bind(null, z.id) as (fd: FormData) => Promise<void>;
  const stavovaZakazka = { konecAktualni: konecAktualniD, stav: z.stav };

  // Barvy podle osoby – stejná osoba = stejná barva.
  const PALETA = ["#2f5d78", "#b45309", "#0f766e", "#be185d", "#4d7c0f", "#6d28d9", "#0369a1", "#a16207"];
  const poradiOsob: string[] = [];
  for (const p of prirazeni) if (!poradiOsob.includes(p.osoba_id)) poradiOsob.push(p.osoba_id);
  const barvaOsoby = (oid: string) => PALETA[poradiOsob.indexOf(oid) % PALETA.length]!;

  // Časová osa přiřazení – jeden řádek na osobu.
  const casy = prirazeni.flatMap((p) => [parseDay(p.datum_od).getTime(), parseDay(p.datum_do).getTime()]);
  const tlStart = new Date(Math.min(zacatekD.getTime(), ...(casy.length ? casy : [zacatekD.getTime()])));
  const tlKonec = new Date(Math.max(konecAktualniD.getTime(), ...(casy.length ? casy : [konecAktualniD.getTime()])));
  const radkyMap = new Map<string, TRadek>();
  for (const p of prirazeni) {
    if (!radkyMap.has(p.osoba_id)) {
      radkyMap.set(p.osoba_id, {
        id: p.osoba_id,
        label: p.osoba?.name ?? "?",
        pocetRad: 1,
        bary: [],
        znacky: [],
      });
    }
    radkyMap.get(p.osoba_id)!.bary.push({
      od: parseDay(p.datum_od),
      do: parseDay(p.datum_do),
      lane: 0,
      barva: barvaOsoby(p.osoba_id),
      titulek: `${formatCz(parseDay(p.datum_od))} – ${formatCz(parseDay(p.datum_do))}`,
    });
  }
  const tlRadky = Array.from(radkyMap.values());

  return (
    <div className="space-y-8">
      <div>
        <Link href="/zakazky" className="text-sm text-text-muted hover:underline">← Akce</Link>
        {rodic && (
          <p className="mt-1 text-sm text-text-muted">
            Zakázka k akci{" "}
            <Link href={`/zakazky/${rodic.id}`} className="font-mono text-link hover:underline">{rodic.kod}</Link>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{z.kod}</h1>
          <StavBadge z={stavovaZakazka} />
          <span title="1 = nejvyšší, 5 = nejnižší" className="badge bg-slate-100 text-slate-500">Priorita {z.priorita}</span>
          <div className="ml-auto flex gap-2">
            <Link href={`/zakazky/${z.id}/tisk?print=1`} className="btn-ghost">🖨 Export do PDF</Link>
            <Link href={`/zakazky/${z.id}/upravit`} className="btn-ghost">✏️ Upravit</Link>
          </div>
        </div>
        <p className="mt-1 text-text-muted">{z.misto_plneni}</p>
        {z.odpovedna && (
          <p className="mt-1 text-sm text-text-muted">Odpovědná osoba: {z.odpovedna.name}</p>
        )}
        {/* Integrace: původ zakázky */}
        {(z.inquiry || z.customer) && (
          <p className="mt-1 text-sm text-text-muted">
            {z.customer && <>Zákazník: <span className="text-text">{z.customer.name}</span></>}
            {z.customer && z.inquiry && " · "}
            {z.inquiry && (
              <>
                vznikla z poptávky{" "}
                <Link href={`/poptavky/${z.inquiry.id}`} className="text-link hover:underline">
                  #{z.inquiry.number} · {z.inquiry.subject}
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Termíny</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-text-muted">Začátek</span><br />{formatCz(zacatekD)}</div>
          <div>
            <span className="text-text-muted">Konec</span><br />
            {prodlouzeno ? (
              <>
                <span className="text-text-muted line-through">{formatCz(konecPuvodniD)}</span>{" "}
                <strong>{formatCz(konecAktualniD)}</strong>
              </>
            ) : (
              formatCz(konecAktualniD)
            )}
          </div>
          <div><span className="text-text-muted">Prodlouženo</span><br />{prodlouzeni.length}×</div>
        </div>
        {z.poznamka && <p className="mt-3 text-sm text-text-muted">{z.poznamka}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Přiřazení pracovníci</h2>

        {tlRadky.length > 0 && <Timeline start={tlStart} konec={tlKonec} radky={tlRadky} />}

        <div className="card divide-y divide-line">
          {prirazeni.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: barvaOsoby(p.osoba_id) }} />
              <span className="font-medium">{p.osoba?.name ?? "?"}</span>
              <span className="ml-auto text-text-muted">
                {formatCz(parseDay(p.datum_od))} – {formatCz(parseDay(p.datum_do))}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Zakázky k akci + souhrn všech lidí na akci (rychlé založení pod pracovníky) */}
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Zakázky k akci</h2>

        {podzakazky.length > 0 && lideAkce.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-bg p-2 text-sm">
            <span className="text-text-muted">Lidé na akci:</span>
            <Lide lide={lideAkce} />
          </div>
        )}

        {podzakazky.length > 0 && (
          <div className="divide-y divide-line rounded-md border border-line">
            {podzakazky.map((p) => (
              <Link key={p.id} href={`/zakazky/${p.id}`} className="block px-3 py-2 hover:bg-accent">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono font-semibold">{p.kod}</span>
                  <span className="flex-1 truncate text-text-muted">{p.popis || p.misto_plneni}</span>
                  <StavBadge z={{ konecAktualni: parseDay(p.konec_aktualni), stav: p.stav }} />
                </div>
                <div className="mt-1">
                  <Lide lide={lidiMap.get(p.id) ?? []} />
                </div>
              </Link>
            ))}
          </div>
        )}
        <ZalozitPodzakazku parentId={z.id} />
      </section>

      <MilnikyEditor
        zakazkaId={z.id}
        milniky={milniky.map((m) => ({
          id: m.id,
          typ: m.typ,
          datum: m.datum,
          cas: m.cas,
          poznamka: m.poznamka,
        }))}
      />

      <PoznamkyAkce zakazkaId={z.id} poznamky={poznamky} />

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Změna termínu (prodloužit / zkrátit)</h2>
        <ProdlouzeniForm akce={akceProdlouzit} />
        {prodlouzeni.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            {prodlouzeni.map((p) => (
              <div key={p.id} className="text-text-muted">
                <span>{formatCz(parseDay(p.stary_konec))} → </span>
                <strong className="text-text">{formatCz(parseDay(p.novy_konec))}</strong> — {p.duvod}
                <span> ({p.provedl?.name ?? "?"})</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Přerušení akce</h2>
        {otevrenePreruseni ? (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-500">
              Akce je přerušená od {formatCz(parseDay(otevrenePreruseni.datum_od))} — zbývá{" "}
              <strong>{otevrenePreruseni.zbyvajici_dny} dnů</strong> práce. Důvod: {otevrenePreruseni.duvod}.{" "}
              Přerušil: {otevrenePreruseni.prerusil?.name ?? "?"}.
            </div>
            <PreruseniForm mode="obnovit" akce={akceObnovit} />
          </div>
        ) : (
          <PreruseniForm mode="prerusit" akce={akcePrerusit} />
        )}
        {preruseni.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            {preruseni.map((p) => (
              <div key={p.id} className="text-text-muted">
                <span>{formatCz(parseDay(p.datum_od))}</span>
                {p.datum_do ? (
                  <> → <strong className="text-text">{formatCz(parseDay(p.datum_do))}</strong> (obnoveno)</>
                ) : (
                  " (probíhá)"
                )}
                {" — "}{p.duvod}
                <span>
                  {" "}(přerušil {p.prerusil?.name ?? "?"}
                  {p.obnovil ? `, obnovil ${p.obnovil.name}` : ""})
                </span>
              </div>
            ))}
          </div>
        )}
      </section>


      {/* Integrace: konstrukční projekty této zakázky */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Konstrukční projekty
        </h2>
        <KonstrukcniProjekty zakazkaId={z.id} />
      </section>

      <section className="flex flex-wrap gap-3">
        <StavTlacitko id={z.id} stav="DOKONCENO" label="Označit dokončeno" cls="btn-primary" />
        <StavTlacitko id={z.id} stav="AKTIVNI" label="Znovu aktivovat" cls="btn-ghost" />
        <StavTlacitko id={z.id} stav="ARCHIV" label="Archivovat" cls="btn-danger" />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Historie změn</h2>
        <div className="card divide-y divide-line text-sm">
          {audit.map((a) => {
            const popis = a.nova_hodnota && typeof a.nova_hodnota === "object" && a.nova_hodnota.popis
              ? String(a.nova_hodnota.popis)
              : null;
            return (
              <div key={a.id} className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="badge bg-slate-100 text-slate-600">{TYP_ZMENY_LABEL[a.typ_zmeny] ?? a.typ_zmeny}</span>
                  <span className="text-text-muted">{a.uzivatel?.name ?? "?"}</span>
                  <span className="ml-auto text-text-muted">{formatCz(new Date(a.created_at))}</span>
                </div>
                {popis && <p className="mt-0.5 text-text-muted">{popis}</p>}
              </div>
            );
          })}
          {audit.length === 0 && <p className="px-4 py-2 text-text-muted">Žádné záznamy.</p>}
        </div>
      </section>

      <section className="border-t border-line pt-4">
        <SmazatButton akce={akceSmazat} />
      </section>
    </div>
  );
}

function Lide({ lide }: { lide: Osoba[] }) {
  if (lide.length === 0) return <span className="text-xs text-text-muted">bez lidí</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {lide.map((o) => (
        <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pl-1 pr-2 text-[11px]" title={o.name}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: userColor(o.colorIndex) }} />
          {o.name}
        </span>
      ))}
    </span>
  );
}

async function KonstrukcniProjekty({ zakazkaId }: { zakazkaId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, status, owner:profiles!projects_owner_id_fkey(name), tasks(id, assignee_id, assignee:profiles(name))")
    .eq("zakazka_id", zakazkaId)
    .order("created_at", { ascending: true });
  const projekty = (data ?? []) as unknown as {
    id: string;
    name: string;
    status: string;
    owner: { name: string } | null;
    tasks: { id: string; assignee_id: string | null; assignee: { name: string } | null }[];
  }[];

  const distinct = (jmena: (string | null | undefined)[]) =>
    Array.from(new Set(jmena.filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, "cs"));

  // Konstruktéři na celé zakázce = jedineční řešitelé podúkolů všech projektů.
  const vsichniKonstrukteri = distinct(
    projekty.flatMap((p) => p.tasks.map((t) => (t.assignee_id ? t.assignee?.name : null))),
  );

  return (
    <div className="space-y-3">
      {vsichniKonstrukteri.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-text-muted">Konstruktéři:</span>
          {vsichniKonstrukteri.map((n) => (
            <span key={n} className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-text">{n}</span>
          ))}
        </div>
      )}
      {projekty.length === 0 ? (
        <p className="text-sm text-text-muted">Zatím žádné konstrukční projekty.</p>
      ) : (
        <div className="divide-y divide-line rounded-md border border-line">
          {projekty.map((p) => {
            const konstrukteri = distinct(p.tasks.map((t) => (t.assignee_id ? t.assignee?.name : null)));
            return (
              <Link key={p.id} href="/konstrukce" className="block px-3 py-2 text-sm hover:bg-accent">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{p.name}</span>
                  {p.owner && <span className="text-text-muted">zodpovídá {p.owner.name}</span>}
                  <span className="ml-auto text-xs text-text-muted">{p.tasks.length} úkolů</span>
                  {p.status === "archived" && <span className="badge bg-slate-100 text-slate-500">archiv</span>}
                </div>
                {konstrukteri.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-text-muted">
                    {konstrukteri.map((n) => (
                      <span key={n} className="rounded border border-line px-1.5 py-0.5">{n}</span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
      <ZalozitProjekt zakazkaId={zakazkaId} />
    </div>
  );
}

function StavTlacitko({
  id,
  stav,
  label,
  cls,
}: {
  id: string;
  stav: "DOKONCENO" | "ARCHIV" | "AKTIVNI" | "POZASTAVENO";
  label: string;
  cls: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await zmenitStav(id, stav);
      }}
    >
      <SubmitButton className={cls} pendingText="Ukládám…">{label}</SubmitButton>
    </form>
  );
}
