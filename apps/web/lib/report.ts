// ----------------------------------------------------------------------------
//  Report pro vedení – načtení dat (sdílené obrazovkou /report a tiskem).
//  Výpočty jsou v @erp/core/report (čisté funkce s testy); tady jen dotazy
//  a poskládání do jedné struktury. Peníze v systému nejsou → provozní report.
// ----------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { formatDay, today } from "@/lib/zakazky/dates";
import {
  mesicniOkno,
  reportOkno,
  radaMesicu,
  vytizeniOsoby,
  pokrytePracovniDny,
  uspesnostPoptavek,
  vObdobi,
  dniMezi,
  type Obdobi,
  INQUIRY_STATUS_LABELS,
  ODDELENI,
  ODDELENI_LABELS,
  ODDELENI_KAPITOLA,
  ROLE_LABELS,
  type InquiryStatus,
  type Oddeleni,
  type Role,
  type StavZakazky,
} from "@erp/core";

export type ReportPoTerminu = { id: string; kod: string; misto: string; konec: string; dni: number };
export type ReportFakturace = { id: string; kod: string; popis: string; dni: number | null };
export type ReportProdlouzeni = { kod: string; zakazkaId: string; staryKonec: string; novyKonec: string; duvod: string };
export type ReportVytizeni = {
  id: string;
  jmeno: string;
  oddeleni: string | null;
  kapitola: "dilna" | "kancelar" | null;
  pokryto: number;
  fond: number;
  podil: number;
  absenceDny: number;
};
export type ReportManazer = {
  id: string;
  jmeno: string;
  /** popisek pozice (oddělení, u vedení role) */
  pozice: string;
  /** akce (hlavní), kde je osoba odpovědná a akce zasahuje do období */
  akce: number;
  /** poptávky přijaté v období, kde je osoba odpovědná */
  poptavky: number;
  objednano: number;
  zamitnuto: number;
  /** objednáno / (objednáno + zamítnuto) z poptávek osoby v období */
  uspesnost: number | null;
};

export type ReportTrendMesic = {
  mesic: string; // YYYY-MM
  poptavkyPrijate: number;
  poptavkyObjednane: number;
  akceZahajene: number;
  akceKoncici: number;
};

export type ReportData = {
  /** „YYYY-MM" (měsíc) nebo „YYYY" (rok) */
  ref: string;
  typ: "mesic" | "rok";
  obdobi: Obdobi;
  dnes: string;
  poptavky: {
    prijate: number;
    objednano: number;
    zamitnuto: number;
    uspesnost: number | null;
    otevrene: { stav: InquiryStatus; label: string; pocet: number }[];
    otevreneCelkem: number;
  };
  zakazky: {
    aktivni: number;
    pozastaveno: number;
    poTerminu: ReportPoTerminu[];
    zahajene: number;
    koncici: number;
    prodlouzeni: ReportProdlouzeni[];
  };
  fakturace: { polozky: ReportFakturace[]; proplacenoCelkem: number };
  vytizeni: ReportVytizeni[];
  /** Projekťáci: akce na starost + jejich poptávky. */
  projektaci: ReportManazer[];
  /** Obchodní manažeři a vedení: poptávky na starost + úspěšnost objednání. */
  obchodnici: ReportManazer[];
  konstrukce: { aktivniProjekty: number; dokonceneUkoly: number; poTerminuUkoly: number };
  trend: ReportTrendMesic[];
};

const TREND_MESICU = 6;

export async function nactiReport(ref?: string): Promise<ReportData> {
  const supabase = await createClient();
  const dnes = formatDay(today());
  const rozsah = reportOkno(ref, dnes);
  const { obdobi, typ } = rozsah;
  // Trend: u měsíce posledních 6 měsíců, u roku všech 12 měsíců daného roku.
  const mesice = typ === "rok" ? radaMesicu(`${rozsah.ref}-12`, 12) : radaMesicu(rozsah.ref, TREND_MESICU);
  const trendOd = `${mesice[0]}-01`; // spodní mez dotazů pro trend

  const [inqRes, logyRes, zakRes, prodlRes, prirRes, absRes, projRes, taskRes] = await Promise.all([
    // Poptávky: přijaté v trendovém okně + aktuálně otevřené (rozpad stavů).
    supabase.from("inquiries").select("id, status, received_at, person_id").gte("received_at", `${trendOd}T00:00:00Z`),
    // Uzavření poptávek (objednáno/zamítnuto) podle stavových logů.
    supabase
      .from("status_logs")
      .select("to_status, created_at")
      .in("to_status", ["OBJEDNANO", "ZAMITNUTO"])
      .gte("created_at", `${trendOd}T00:00:00Z`),
    // Akce (hlavní i podzakázky; počty vedeme za hlavní akce).
    supabase
      .from("zakazky")
      .select("id, kod, misto_plneni, popis, parent_id, zacatek, konec_aktualni, stav, fakturace_od, odpovedna_osoba_id")
      .is("deleted_at", null),
    // Prodloužení termínů v období.
    supabase
      .from("prodlouzeni")
      .select("stary_konec, novy_konec, duvod, created_at, zakazka:zakazky!inner(id, kod, deleted_at)")
      .gte("created_at", `${obdobi.od}T00:00:00Z`)
      .lte("created_at", `${obdobi.do}T23:59:59Z`),
    // Přiřazení lidí protínající období (vytížení).
    supabase
      .from("prirazeni_zakazka")
      .select("osoba_id, datum_od, datum_do, zakazka:zakazky!inner(deleted_at)")
      .is("deleted_at", null)
      .is("zakazka.deleted_at", null)
      .lte("datum_od", obdobi.do)
      .gte("datum_do", obdobi.od),
    // Absence protínající období.
    supabase.from("absences").select("profile_id, start_date, end_date").lte("start_date", obdobi.do).gte("end_date", obdobi.od),
    // Konstrukce: aktivní projekty.
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    // Konstrukce: aktivní úkoly (dokončené v období / po termínu).
    supabase.from("tasks").select("id, completed, completed_at, end_date").eq("status", "active"),
  ]);

  // ---- Poptávky --------------------------------------------------------------
  type Inq = { id: string; status: InquiryStatus; received_at: string; person_id: string | null };
  const inquiries = (inqRes.data ?? []) as Inq[];
  const logy = (logyRes.data ?? []) as { to_status: "OBJEDNANO" | "ZAMITNUTO"; created_at: string }[];

  const OTEVRENE: InquiryStatus[] = ["NOVA", "V_JEDNANI", "ODESLANA", "NEREAGUJE", "ODLOZENO"];
  // Otevřené poptávky bez ohledu na stáří – druhý dotaz by byl přesnější, ale
  // otevřené poptávky starší než trendové okno v praxi nejsou; doplníme je zvlášť:
  const { data: otevreneVse } = await supabase.from("inquiries").select("status").in("status", OTEVRENE);
  const otevrene = OTEVRENE.map((s) => ({
    stav: s,
    label: INQUIRY_STATUS_LABELS[s],
    pocet: (otevreneVse ?? []).filter((i) => i.status === s).length,
  })).filter((s) => s.pocet > 0);

  const objednano = logy.filter((l) => l.to_status === "OBJEDNANO" && vObdobi(l.created_at, obdobi)).length;
  const zamitnuto = logy.filter((l) => l.to_status === "ZAMITNUTO" && vObdobi(l.created_at, obdobi)).length;

  // ---- Zakázky ---------------------------------------------------------------
  type Zak = {
    id: string; kod: string; misto_plneni: string; popis: string | null; parent_id: string | null;
    zacatek: string; konec_aktualni: string; stav: StavZakazky; fakturace_od: string | null;
    odpovedna_osoba_id: string | null;
  };
  const zakazky = (zakRes.data ?? []) as Zak[];
  const hlavni = zakazky.filter((z) => !z.parent_id);

  const poTerminu: ReportPoTerminu[] = hlavni
    .filter((z) => (z.stav === "AKTIVNI" || z.stav === "POZASTAVENO") && z.konec_aktualni < dnes)
    .map((z) => ({ id: z.id, kod: z.kod, misto: z.misto_plneni, konec: z.konec_aktualni, dni: dniMezi(z.konec_aktualni, dnes) }))
    .sort((a, b) => b.dni - a.dni);

  const prodlouzeni: ReportProdlouzeni[] = ((prodlRes.data ?? []) as unknown as {
    stary_konec: string; novy_konec: string; duvod: string; zakazka: { id: string; kod: string; deleted_at: string | null };
  }[])
    .filter((p) => !p.zakazka.deleted_at)
    .map((p) => ({ kod: p.zakazka.kod, zakazkaId: p.zakazka.id, staryKonec: p.stary_konec, novyKonec: p.novy_konec, duvod: p.duvod }));

  // ---- Fakturace -------------------------------------------------------------
  const fakturace: ReportFakturace[] = hlavni
    .filter((z) => z.stav === "FAKTURACE")
    .map((z) => ({
      id: z.id,
      kod: z.kod,
      popis: z.popis || z.misto_plneni,
      dni: z.fakturace_od ? dniMezi(z.fakturace_od, dnes) : null,
    }))
    .sort((a, b) => (b.dni ?? -1) - (a.dni ?? -1));

  // ---- Vytížení lidí ---------------------------------------------------------
  const { data: lide } = await supabase
    .from("profiles")
    .select("id, name, oddeleni")
    .eq("active", true)
    .eq("assignable", true)
    .order("name");
  const prirazeni = (prirRes.data ?? []) as unknown as { osoba_id: string; datum_od: string; datum_do: string }[];
  const absence = (absRes.data ?? []) as { profile_id: string; start_date: string; end_date: string }[];

  const vytizeni: ReportVytizeni[] = ((lide ?? []) as { id: string; name: string; oddeleni: string | null }[])
    .map((o) => {
      const moje = prirazeni.filter((p) => p.osoba_id === o.id).map((p) => ({ od: p.datum_od, do: p.datum_do }));
      const mojeAbs = absence.filter((a) => a.profile_id === o.id).map((a) => ({ od: a.start_date, do: a.end_date }));
      const v = vytizeniOsoby(moje, obdobi);
      return {
        id: o.id,
        jmeno: o.name,
        oddeleni: o.oddeleni,
        kapitola: o.oddeleni ? (ODDELENI_KAPITOLA[o.oddeleni as Oddeleni] ?? null) : null,
        pokryto: v.pokryto,
        fond: v.fond,
        podil: v.podil,
        absenceDny: pokrytePracovniDny(mojeAbs, obdobi),
      };
    })
    .sort((a, b) => b.podil - a.podil || a.jmeno.localeCompare(b.jmeno, "cs"));

  // ---- Manažeři (projekťáci, obchodní manažeři a vedení) ---------------------
  const { data: profilyData } = await supabase.from("profiles").select("id, name, oddeleni, role").eq("active", true);
  const profily = (profilyData ?? []) as { id: string; name: string; oddeleni: string | null; role: string }[];

  // Poptávky osoby přijaté v období + kolik z nich je dnes objednáno/zamítnuto.
  const poptavkyVObdobi = inquiries.filter((i) => vObdobi(i.received_at, obdobi));
  const poptavkyOsoby = (osobaId: string) => {
    const moje = poptavkyVObdobi.filter((i) => i.person_id === osobaId);
    const obj = moje.filter((i) => i.status === "OBJEDNANO").length;
    const zam = moje.filter((i) => i.status === "ZAMITNUTO").length;
    return { poptavky: moje.length, objednano: obj, zamitnuto: zam, uspesnost: uspesnostPoptavek(obj, zam) };
  };

  // Akce (hlavní) zasahující do období podle odpovědné osoby.
  const akceOsoby = new Map<string, number>();
  for (const z of hlavni) {
    if (!z.odpovedna_osoba_id) continue;
    if (z.zacatek > obdobi.do || z.konec_aktualni < obdobi.od) continue;
    akceOsoby.set(z.odpovedna_osoba_id, (akceOsoby.get(z.odpovedna_osoba_id) ?? 0) + 1);
  }

  const pozice = (p: { oddeleni: string | null; role: string }) =>
    p.oddeleni
      ? (ODDELENI_LABELS[p.oddeleni as Oddeleni] ?? p.oddeleni)
      : (ROLE_LABELS[p.role as Role] ?? p.role);

  // Projekťáci: všichni z oddělení Projekťák + kdokoli další, kdo má v období
  // akci na starost (odpovědná osoba akce).
  const projektaci: ReportManazer[] = profily
    .filter((p) => p.oddeleni === "projektak" || akceOsoby.has(p.id))
    .map((p) => ({
      id: p.id,
      jmeno: p.name,
      pozice: pozice(p),
      akce: akceOsoby.get(p.id) ?? 0,
      ...poptavkyOsoby(p.id),
    }))
    .sort((a, b) => b.akce - a.akce || b.poptavky - a.poptavky || a.jmeno.localeCompare(b.jmeno, "cs"));

  // Obchodní manažeři vždy; vedení (vedoucí/admin) jen když v období nějakou
  // poptávku na starost mělo. Projekťáky tu neduplikujeme.
  const obchodnici: ReportManazer[] = profily
    .filter((p) => p.oddeleni !== "projektak")
    .filter(
      (p) =>
        p.oddeleni === "obchodni_manazer" ||
        ((p.role === "vedouci" || p.role === "admin") && poptavkyVObdobi.some((i) => i.person_id === p.id)),
    )
    .map((p) => ({ id: p.id, jmeno: p.name, pozice: pozice(p), akce: akceOsoby.get(p.id) ?? 0, ...poptavkyOsoby(p.id) }))
    .sort((a, b) => b.poptavky - a.poptavky || a.jmeno.localeCompare(b.jmeno, "cs"));

  // ---- Konstrukce ------------------------------------------------------------
  const tasks = (taskRes.data ?? []) as { id: string; completed: boolean; completed_at: string | null; end_date: string | null }[];
  const konstrukce = {
    aktivniProjekty: projRes.count ?? 0,
    dokonceneUkoly: tasks.filter((t) => t.completed && t.completed_at && vObdobi(t.completed_at, obdobi)).length,
    poTerminuUkoly: tasks.filter((t) => !t.completed && t.end_date && t.end_date < dnes).length,
  };

  // ---- Trend po měsících -----------------------------------------------------
  const trend: ReportTrendMesic[] = mesice.map((m) => {
    const okno = mesicniOkno(m, dnes);
    return {
      mesic: m,
      poptavkyPrijate: inquiries.filter((i) => vObdobi(i.received_at, okno)).length,
      poptavkyObjednane: logy.filter((l) => l.to_status === "OBJEDNANO" && vObdobi(l.created_at, okno)).length,
      akceZahajene: hlavni.filter((z) => vObdobi(z.zacatek, okno)).length,
      akceKoncici: hlavni.filter((z) => vObdobi(z.konec_aktualni, okno)).length,
    };
  });

  return {
    ref: rozsah.ref,
    typ,
    obdobi,
    dnes,
    poptavky: {
      prijate: inquiries.filter((i) => vObdobi(i.received_at, obdobi)).length,
      objednano,
      zamitnuto,
      uspesnost: uspesnostPoptavek(objednano, zamitnuto),
      otevrene,
      otevreneCelkem: (otevreneVse ?? []).length,
    },
    zakazky: {
      aktivni: hlavni.filter((z) => z.stav === "AKTIVNI").length,
      pozastaveno: hlavni.filter((z) => z.stav === "POZASTAVENO").length,
      poTerminu,
      zahajene: hlavni.filter((z) => vObdobi(z.zacatek, obdobi)).length,
      koncici: hlavni.filter((z) => vObdobi(z.konec_aktualni, obdobi)).length,
      prodlouzeni,
    },
    fakturace: {
      polozky: fakturace,
      proplacenoCelkem: hlavni.filter((z) => z.stav === "PROPLACENO").length,
    },
    vytizeni,
    projektaci,
    obchodnici,
    konstrukce,
    trend,
  };
}

/** Smí uživatel vidět report? (admin nebo vedoucí) */
export function smiVidetReport(role: string | undefined): boolean {
  return role === "admin" || role === "vedouci";
}

export type VytizeniSkupina = { nazev: string; lide: ReportVytizeni[]; prumer: number };

/**
 * Seskupí vytížení podle oddělení v pořadí číselníku (Výroba, Montáž, Elektro,
 * Kancelář…); lidé bez oddělení jdou na konec. Prázdné skupiny se vynechají.
 */
export function vytizeniPodleOddeleni(vytizeni: ReportVytizeni[]): VytizeniSkupina[] {
  const skupiny: VytizeniSkupina[] = [];
  for (const odd of [...ODDELENI, null]) {
    const lide = vytizeni.filter((v) => (odd === null ? !v.oddeleni : v.oddeleni === odd));
    if (lide.length === 0) continue;
    skupiny.push({
      nazev: odd === null ? "Bez oddělení" : ODDELENI_LABELS[odd],
      lide,
      prumer: lide.reduce((s, v) => s + v.podil, 0) / lide.length,
    });
  }
  return skupiny;
}
