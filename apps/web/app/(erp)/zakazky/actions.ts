"use server";
// ----------------------------------------------------------------------------
//  Server actions modulu Zakázky. Port z Planovani/src/app/(app)/zakazky/
//  actions.ts – logika 1:1 (kolize, náhradníci, prodloužení, přerušení,
//  milníky, poznámky, audit), datová vrstva Prisma → supabase-js + RLS.
//  Nové (integrace ERP): zakázka může vzniknout z poptávky (inquiry_id)
//  a dědí zákazníka (customer_id).
// ----------------------------------------------------------------------------
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { canWrite, muzeOdebratKonstruktera, type Role, type TypZmeny , porovnatDlePrijmeni } from "@erp/core";
import {
  zakazkaSchema,
  zakazkaUpravaSchema,
  prodlouzeniSchema,
  milnikSchema,
} from "@/lib/zakazky/validations";
import { parseDay, formatDay, formatCz, dayBefore, addDays, today } from "@/lib/zakazky/dates";
import { najdiKolize, navrhniReseni, type ExistujiciPrirazeni } from "@/lib/zakazky/collisions";

export type KolizeInfo = {
  osobaId: string;
  osobaJmeno: string;
  prirazeniId: string;
  zakazkaId: string;
  zakazkaKod: string;
  od: string;
  do: string;
  novyOd: string;
  novyDo: string;
  predOd: string | null;
  predDo: string | null;
  poOd: string | null;
  poDo: string | null;
  nahradnikOd: string;
  nahradnikDo: string;
  obsazeni: { osobaId: string; od: string; do: string }[];
};

export type ZakazkaStav = {
  chyby?: Record<string, string>;
  obecna?: string;
  kolize?: KolizeInfo[];
};

type Db = Awaited<ReturnType<typeof createClient>>;

async function writer() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!canWrite(profile.role as Role)) return null;
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role as Role,
    sefkonstrukter: !!profile.sefkonstrukter,
  };
}

async function zapisAudit(
  supabase: Db,
  args: {
    entita: string;
    entitaId: string;
    typZmeny: TypZmeny;
    uzivatelId: string;
    puvodni?: unknown;
    nova?: unknown;
  },
) {
  await supabase.from("audit_log").insert({
    entita: args.entita,
    entita_id: args.entitaId,
    typ_zmeny: args.typZmeny,
    uzivatel_id: args.uzivatelId,
    puvodni_hodnota: (args.puvodni ?? null) as never,
    nova_hodnota: (args.nova ?? null) as never,
  });
}

function ziskatData(fd: FormData) {
  const osobaIds = fd.getAll("prir_osobaId").map(String);
  const od = fd.getAll("prir_od").map(String);
  const doo = fd.getAll("prir_do").map(String);
  const prirazeni = osobaIds
    .map((osobaId, i) => ({ osobaId, datumOd: od[i] ?? "", datumDo: doo[i] ?? "" }))
    .filter((p) => p.osobaId);
  return {
    kod: String(fd.get("kod") ?? ""),
    mistoPlneni: String(fd.get("mistoPlneni") ?? ""),
    priorita: String(fd.get("priorita") ?? "3"),
    zacatek: String(fd.get("zacatek") ?? ""),
    konec: String(fd.get("konec") ?? ""),
    poznamka: String(fd.get("poznamka") ?? ""),
    odpovednaOsobaId: String(fd.get("odpovednaOsobaId") ?? ""),
    inquiryId: String(fd.get("inquiryId") ?? ""),
    customerId: String(fd.get("customerId") ?? ""),
    parentId: String(fd.get("parentId") ?? ""),
    prirazeni,
  };
}

/**
 * Odpovědnou osobou akce smí být jen Projekťák (oddělení) nebo role Vedoucí –
 * ne Kancelář. Prázdná hodnota je v pořádku (odpovědná osoba je nepovinná).
 */
async function jeOdpovednaPovolena(supabase: Db, osobaId: string | null | undefined): Promise<boolean> {
  if (!osobaId) return true;
  const { data } = await supabase.from("profiles").select("oddeleni, role").eq("id", osobaId).maybeSingle();
  return !!data && (data.oddeleni === "projektak" || data.role === "vedouci");
}

/** Všechna živá přiřazení daných osob (join na kód zakázky a jméno osoby). */
async function nactiExistujiciPrirazeni(supabase: Db, osobaIds: string[]) {
  // Přiřazení na POZASTAVENÝCH akcích se do kolizí nepočítají (lidé jsou volní).
  const { data } = await supabase
    .from("prirazeni_zakazka")
    .select("id, zakazka_id, osoba_id, datum_od, datum_do, zakazka:zakazky!inner(kod, deleted_at, stav), osoba:profiles(name)")
    .in("osoba_id", osobaIds)
    .is("deleted_at", null)
    .is("zakazka.deleted_at", null)
    .neq("zakazka.stav", "POZASTAVENO");
  return (data ?? []) as unknown as {
    id: string;
    zakazka_id: string;
    osoba_id: string;
    datum_od: string;
    datum_do: string;
    zakazka: { kod: string };
    osoba: { name: string } | null;
  }[];
}

/**
 * Zakázka k akci (child) se v Konstrukci NEzobrazuje jako samostatný projekt,
 * ale jako podúkol v konstrukčním projektu hlavní akce – aby Konstrukce
 * odpovídala tabuli (akce → zakázky k akci). Task.zakazka_id = child, takže
 * konstruktér přiřazený k podúkolu se propíše ke správné zakázce k akci.
 */
async function pridatKonstrukcniPodukol(
  supabase: Db,
  parentZakazkaId: string,
  childZakazkaId: string,
  nazev: string,
): Promise<void> {
  let { data: hlavniProjekt } = await supabase
    .from("projects")
    .select("id")
    .eq("zakazka_id", parentZakazkaId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!hlavniProjekt) {
    const { data: parent } = await supabase
      .from("zakazky").select("kod").eq("id", parentZakazkaId).maybeSingle();
    const { data: novy } = await supabase
      .from("projects")
      .insert({ zakazka_id: parentZakazkaId, name: parent?.kod ?? "Akce", owner_id: null })
      .select("id")
      .single();
    hlavniProjekt = novy;
  }
  if (hlavniProjekt) {
    await supabase.from("tasks").insert({
      project_id: hlavniProjekt.id,
      zakazka_id: childZakazkaId,
      name: nazev,
    });
  }
}

export async function vytvoritZakazku(_prev: ZakazkaStav, fd: FormData): Promise<ZakazkaStav> {
  const u = await writer();
  if (!u) return { obecna: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();

  const parsed = zakazkaSchema.safeParse(ziskatData(fd));
  if (!parsed.success) {
    const chyby: Record<string, string> = {};
    for (const i of parsed.error.issues) chyby[i.path.join(".")] = i.message;
    return { chyby };
  }
  const d = parsed.data;

  if (!(await jeOdpovednaPovolena(supabase, d.odpovednaOsobaId))) {
    return { chyby: { odpovednaOsobaId: "Odpovědnou osobou může být jen Projekťák nebo Vedoucí." } };
  }

  const { data: kodExistuje } = await supabase
    .from("zakazky").select("id").eq("kod", d.kod).is("deleted_at", null).maybeSingle();
  if (kodExistuje) return { chyby: { kod: "Akce s tímto kódem už existuje." } };

  // Uvolni kód po dříve smazané akci (měkké smazání), ať jde znovu použít.
  const { data: smazanaSKodem } = await supabase
    .from("zakazky").select("id, kod").eq("kod", d.kod).not("deleted_at", "is", null).maybeSingle();
  if (smazanaSKodem) {
    await supabase
      .from("zakazky")
      .update({ kod: `${smazanaSKodem.kod} (smazáno ${smazanaSKodem.id.slice(0, 6)})` })
      .eq("id", smazanaSKodem.id);
  }

  // --- Kontrola kolizí: blokující ---
  const osobaIds = [...new Set(d.prirazeni.map((p) => p.osobaId))];
  const existujici = await nactiExistujiciPrirazeni(supabase, osobaIds);

  // Dovolená blokuje natvrdo už při zakládání akce.
  for (const p of d.prirazeni) {
    const dov = await dovolenaVObdobi(supabase, p.osobaId, parseDay(p.datumOd), parseDay(p.datumDo));
    if (dov) {
      const { data: os } = await supabase.from("profiles").select("name").eq("id", p.osobaId).maybeSingle();
      return { obecna: `${os?.name ?? "Pracovník"} ${dov} – v tomto období ho nelze přiřadit k akci.` };
    }
  }

  const kolize: KolizeInfo[] = [];
  for (const p of d.prirazeni) {
    const novy = { datumOd: parseDay(p.datumOd), datumDo: parseDay(p.datumDo) };
    const kandidati: ExistujiciPrirazeni[] = existujici
      .filter((e) => e.osoba_id === p.osobaId)
      .map((e) => ({
        id: e.id,
        zakazkaId: e.zakazka_id,
        zakazkaKod: e.zakazka.kod,
        datumOd: parseDay(e.datum_od),
        datumDo: parseDay(e.datum_do),
      }));
    for (const k of najdiKolize(novy, kandidati)) {
      const navrh = navrhniReseni(novy, k);
      const os = existujici.find((e) => e.id === k.id)!.osoba;
      const prekrOd = navrh.obdobiProNahradnika.datumOd;
      const prekrDo = navrh.obdobiProNahradnika.datumDo;

      // Kdo je v období překryvu obsazený (na jakékoli akci).
      const { data: obsazeniRaw } = await supabase
        .from("prirazeni_zakazka")
        .select("osoba_id, datum_od, datum_do, zakazka:zakazky!inner(deleted_at)")
        .is("deleted_at", null)
        .is("zakazka.deleted_at", null)
        .lte("datum_od", formatDay(prekrDo))
        .gte("datum_do", formatDay(prekrOd));
      const obsazeni = (obsazeniRaw ?? []).map((o) => ({
        osobaId: o.osoba_id,
        od: formatCz(parseDay(o.datum_od)),
        do: formatCz(parseDay(o.datum_do)),
      }));

      kolize.push({
        osobaId: p.osobaId,
        osobaJmeno: os?.name ?? "?",
        prirazeniId: k.id,
        zakazkaId: k.zakazkaId,
        zakazkaKod: k.zakazkaKod,
        od: formatDay(k.datumOd),
        do: formatDay(k.datumDo),
        novyOd: p.datumOd,
        novyDo: p.datumDo,
        predOd: navrh.castPred ? formatDay(navrh.castPred.datumOd) : null,
        predDo: navrh.castPred ? formatDay(navrh.castPred.datumDo) : null,
        poOd: navrh.castPo ? formatDay(navrh.castPo.datumOd) : null,
        poDo: navrh.castPo ? formatDay(navrh.castPo.datumDo) : null,
        nahradnikOd: formatDay(navrh.obdobiProNahradnika.datumOd),
        nahradnikDo: formatDay(navrh.obdobiProNahradnika.datumDo),
        obsazeni,
      });
    }
  }
  if (kolize.length > 0) return { kolize };

  // --- Uložení (zakázka + přiřazení; případné napojení na poptávku) ---
  const { data: zakazka, error } = await supabase
    .from("zakazky")
    .insert({
      kod: d.kod,
      misto_plneni: d.mistoPlneni,
      priorita: d.priorita,
      zacatek: d.zacatek,
      konec_puvodni: d.konec,
      konec_aktualni: d.konec,
      poznamka: d.poznamka || null,
      odpovedna_osoba_id: d.odpovednaOsobaId || null,
      zalozil_id: u.id,
      inquiry_id: d.inquiryId || null,
      customer_id: d.customerId || null,
      parent_id: d.parentId || null,
    })
    .select("id")
    .single();
  if (error || !zakazka) {
    if (error?.code === "23505") return { chyby: { kod: "Akce s tímto kódem už existuje." } };
    return { obecna: "Uložení se nezdařilo." };
  }

  const { error: prirErr } = await supabase.from("prirazeni_zakazka").insert(
    d.prirazeni.map((p) => ({
      zakazka_id: zakazka.id,
      osoba_id: p.osobaId,
      datum_od: p.datumOd,
      datum_do: p.datumDo,
    })),
  );
  if (prirErr) return { obecna: "Přiřazení se nepodařilo uložit." };

  // Integrace s Konstrukcí:
  //  – běžná akce → vlastní „volný“ konstrukční projekt (owner_id = null),
  //  – zakázka k akci (má rodiče) → jen podúkol v projektu hlavní akce,
  //    aby Konstrukce odpovídala tabuli (akce → zakázky k akci) a nevznikal
  //    duplicitní samostatný projekt pro dceřinou zakázku.
  if (d.parentId) {
    await pridatKonstrukcniPodukol(supabase, d.parentId, zakazka.id, d.kod);
  } else {
    // Poptávka s zapnutou konstrukcí: její projekt (vč. úkolů) se přepojí na
    // novou zakázku, aby konstruktérům nic nezmizelo. Jinak nový projekt.
    const { data: inqProjekt } = d.inquiryId
      ? await supabase
          .from("projects").select("id").eq("inquiry_id", d.inquiryId).eq("status", "active").limit(1).maybeSingle()
      : { data: null };
    if (inqProjekt) {
      await supabase
        .from("projects")
        .update({ zakazka_id: zakazka.id, inquiry_id: null })
        .eq("id", inqProjekt.id);
    } else {
      await supabase.from("projects").insert({
        zakazka_id: zakazka.id,
        name: d.kod,
        owner_id: null,
      });
    }
  }

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazka.id, typZmeny: "VYTVORENI", uzivatelId: u.id,
    nova: { kod: d.kod, konstrukcniProjekt: true, ...(d.inquiryId ? { zPoptavky: d.inquiryId } : {}) },
  });
  revalidatePath("/zakazky");
  revalidatePath("/konstrukce");
  redirect(`/zakazky/${zakazka.id}`);
}

/**
 * Rychlé založení podzakázky z detailu hlavní akce (inline lišta).
 * Podzakázka je plnohodnotná zakázka s vlastním číslem; místo, termíny,
 * prioritu a zákazníka zdědí od hlavní akce (lze později upravit).
 */
export async function vytvoritPodzakazku(
  parentId: string,
  cislo: string,
  popis: string,
): Promise<{ ok: boolean; chyba?: string }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  if (!cislo.trim()) return { ok: false, chyba: "Zadejte číslo zakázky." };
  const supabase = await createClient();

  const { data: parent } = await supabase
    .from("zakazky")
    .select("id, kod, misto_plneni, zacatek, konec_aktualni, priorita, customer_id, deleted_at")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent || parent.deleted_at) return { ok: false, chyba: "Hlavní akce nenalezena." };

  // Uvolni kód po dříve smazané zakázce (soft delete drží unikátní kod) –
  // stejně jako při zakládání akce; jinak „číslo existuje", ač není vidět.
  const { data: smazanaSKodem } = await supabase
    .from("zakazky").select("id, kod").eq("kod", cislo.trim()).not("deleted_at", "is", null).maybeSingle();
  if (smazanaSKodem) {
    await supabase
      .from("zakazky")
      .update({ kod: `${smazanaSKodem.kod} (smazáno ${smazanaSKodem.id.slice(0, 6)})` })
      .eq("id", smazanaSKodem.id);
  }

  const { data: child, error } = await supabase
    .from("zakazky")
    .insert({
      kod: cislo.trim(),
      misto_plneni: parent.misto_plneni,
      popis: popis.trim() || null,
      priorita: parent.priorita,
      zacatek: parent.zacatek,
      konec_puvodni: parent.konec_aktualni,
      konec_aktualni: parent.konec_aktualni,
      parent_id: parentId,
      customer_id: parent.customer_id,
      zalozil_id: u.id,
    })
    .select("id")
    .single();
  if (error || !child) {
    if (error?.code === "23505") return { ok: false, chyba: "Zakázka s tímto číslem už existuje." };
    return { ok: false, chyba: "Uložení se nezdařilo." };
  }

  // Konstrukce: zakázka k akci se NEzaloží jako samostatný projekt, ale přidá
  // se jako podúkol do konstrukčního projektu hlavní akce (sdílená logika).
  await pridatKonstrukcniPodukol(supabase, parentId, child.id, cislo.trim());

  await zapisAudit(supabase, {
    entita: "zakazka",
    entitaId: child.id,
    typZmeny: "VYTVORENI",
    uzivatelId: u.id,
    nova: { kod: cislo.trim(), zakazkaKAkci: parentId, konstrukcePodukol: true },
  });
  revalidatePath(`/zakazky/${parentId}`);
  revalidatePath("/zakazky");
  revalidatePath("/konstrukce");
  return { ok: true };
}

/** Řešitel kolize – rozdělení původního nasazení kolem nového období + náhradník. */
export async function vyresitKolizi(
  prirazeniId: string,
  novyOd: string,
  novyDo: string,
  nahradnikOsobaId: string,
  vynutit: boolean = false,
): Promise<{ ok: boolean; chyba?: string }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (!nahradnikOsobaId) return { ok: false, chyba: "Vyberte náhradníka." };
  const supabase = await createClient();

  const { data: p } = await supabase
    .from("prirazeni_zakazka")
    .select("id, zakazka_id, osoba_id, datum_od, datum_do, deleted_at")
    .eq("id", prirazeniId)
    .maybeSingle();
  if (!p || p.deleted_at) return { ok: false, chyba: "Přiřazení nenalezeno." };
  if (nahradnikOsobaId === p.osoba_id) return { ok: false, chyba: "Náhradník musí být jiná osoba." };

  const pOd = parseDay(p.datum_od);
  const pDo = parseDay(p.datum_do);
  const nOd = parseDay(novyOd);
  const nDo = parseDay(novyDo);
  const prekrytiOd = nOd > pOd ? nOd : pOd;
  const prekrytiDo = nDo < pDo ? nDo : pDo;
  if (prekrytiOd > prekrytiDo) return { ok: true }; // žádný překryv

  const castPred = pOd < prekrytiOd ? { od: pOd, do: dayBefore(prekrytiOd) } : null;
  const castPo = pDo > prekrytiDo ? { od: addDays(prekrytiDo, 1), do: pDo } : null;

  // Náhradník nesmí být v překryvu sám obsazený (bez potvrzení).
  const nahrExist = await nactiExistujiciPrirazeni(supabase, [nahradnikOsobaId]);
  const nahrKol = najdiKolize(
    { datumOd: prekrytiOd, datumDo: prekrytiDo },
    nahrExist.map((e) => ({
      id: e.id, zakazkaId: e.zakazka_id, zakazkaKod: e.zakazka.kod,
      datumOd: parseDay(e.datum_od), datumDo: parseDay(e.datum_do),
    })),
  );
  const bylObsazen = nahrKol.length > 0;
  if (bylObsazen && !vynutit) {
    return {
      ok: false,
      chyba: `Náhradník je v období ${formatCz(prekrytiOd)} – ${formatCz(prekrytiDo)} také obsazený (akce ${nahrKol[0]!.zakazkaKod}).`,
    };
  }

  if (castPred) {
    await supabase.from("prirazeni_zakazka")
      .update({ datum_od: formatDay(castPred.od), datum_do: formatDay(castPred.do) }).eq("id", p.id);
    if (castPo) {
      await supabase.from("prirazeni_zakazka").insert({
        zakazka_id: p.zakazka_id, osoba_id: p.osoba_id,
        datum_od: formatDay(castPo.od), datum_do: formatDay(castPo.do),
      });
    }
  } else if (castPo) {
    await supabase.from("prirazeni_zakazka")
      .update({ datum_od: formatDay(castPo.od), datum_do: formatDay(castPo.do) }).eq("id", p.id);
  } else {
    // nové období pokrývá celé původní -> původní se ruší
    await supabase.from("prirazeni_zakazka")
      .update({ deleted_at: new Date().toISOString() }).eq("id", p.id);
  }
  // náhradník na překryv téže akce
  await supabase.from("prirazeni_zakazka").insert({
    zakazka_id: p.zakazka_id, osoba_id: nahradnikOsobaId,
    datum_od: formatDay(prekrytiOd), datum_do: formatDay(prekrytiDo),
  });

  const { data: nahr } = await supabase.from("profiles").select("name").eq("id", nahradnikOsobaId).maybeSingle();
  const popis =
    `Dosazen náhradník ${nahr?.name ?? "?"} (${formatCz(prekrytiOd)} – ${formatCz(prekrytiDo)})` +
    (bylObsazen ? " — POTVRZENO i přes obsazení jinde" : "");

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: p.zakazka_id, typZmeny: "UPRAVA", uzivatelId: u.id,
    puvodni: { osobaId: p.osoba_id, od: p.datum_od, do: p.datum_do },
    nova: { popis, nahradnikOsobaId, prekryvOd: formatDay(prekrytiOd), prekryvDo: formatDay(prekrytiDo), vynuceno: bylObsazen },
  });
  revalidatePath("/zakazky");
  revalidatePath(`/zakazky/${p.zakazka_id}`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

export async function prodlouzit(zakazkaId: string, _prev: ZakazkaStav, fd: FormData): Promise<ZakazkaStav> {
  const u = await writer();
  if (!u) return { obecna: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();

  const { data: z } = await supabase
    .from("zakazky").select("id, zacatek, konec_aktualni, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { obecna: "Akce nenalezena." };

  const parsed = prodlouzeniSchema.safeParse({
    novyKonec: String(fd.get("novyKonec") ?? ""),
    duvod: String(fd.get("duvod") ?? ""),
  });
  if (!parsed.success) {
    const chyby: Record<string, string> = {};
    for (const i of parsed.error.issues) chyby[String(i.path[0])] = i.message;
    return { chyby };
  }
  const novy = parseDay(parsed.data.novyKonec);
  const stary = parseDay(z.konec_aktualni);
  if (novy.getTime() === stary.getTime()) {
    return { chyby: { novyKonec: "Nový termín se musí lišit od aktuálního konce." } };
  }
  if (novy < parseDay(z.zacatek)) {
    return { chyby: { novyKonec: "Konec nesmí být před začátkem akce." } };
  }

  await supabase.from("prodlouzeni").insert({
    zakazka_id: z.id,
    stary_konec: formatDay(stary),
    novy_konec: formatDay(novy),
    duvod: parsed.data.duvod,
    provedl_id: u.id,
  });
  await supabase.from("zakazky").update({ konec_aktualni: formatDay(novy) }).eq("id", z.id);

  if (novy < stary) {
    // Zkrácení: osekat přiřazení přesahující nový konec…
    const { data: presahujici } = await supabase
      .from("prirazeni_zakazka").select("id")
      .eq("zakazka_id", z.id).is("deleted_at", null)
      .lte("datum_od", formatDay(novy)).gt("datum_do", formatDay(novy));
    for (const pr of presahujici ?? []) {
      await supabase.from("prirazeni_zakazka").update({ datum_do: formatDay(novy) }).eq("id", pr.id);
    }
    // …a odebrat ta, která by celá padla za nový konec.
    const { data: zaKoncem } = await supabase
      .from("prirazeni_zakazka").select("id")
      .eq("zakazka_id", z.id).is("deleted_at", null).gt("datum_od", formatDay(novy));
    for (const pr of zaKoncem ?? []) {
      await supabase.from("prirazeni_zakazka").update({ deleted_at: new Date().toISOString() }).eq("id", pr.id);
    }
  } else {
    // Prodloužení: „celodélková" přiřazení protáhnout na nový konec.
    const { data: celodelkova } = await supabase
      .from("prirazeni_zakazka").select("id")
      .eq("zakazka_id", z.id).is("deleted_at", null).eq("datum_do", formatDay(stary));
    for (const pr of celodelkova ?? []) {
      await supabase.from("prirazeni_zakazka").update({ datum_do: formatDay(novy) }).eq("id", pr.id);
    }
  }

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: z.id, typZmeny: "PRODLOUZENI", uzivatelId: u.id,
    puvodni: { konec: formatDay(stary) }, nova: { konec: parsed.data.novyKonec, duvod: parsed.data.duvod },
  });
  revalidatePath(`/zakazky/${z.id}`);
  revalidatePath("/zakazky");
  revalidatePath("/zakazky/plan");
  return {};
}

export async function upravitZakazku(zakazkaId: string, _prev: ZakazkaStav, fd: FormData): Promise<ZakazkaStav> {
  const u = await writer();
  if (!u) return { obecna: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();

  const { data: z } = await supabase
    .from("zakazky")
    .select("id, kod, misto_plneni, priorita, konec_aktualni, deleted_at, montaz_typ, popis")
    .eq("id", zakazkaId)
    .maybeSingle();
  if (!z || z.deleted_at) return { obecna: "Akce nenalezena." };

  const parsed = zakazkaUpravaSchema.safeParse({
    kod: String(fd.get("kod") ?? ""),
    mistoPlneni: String(fd.get("mistoPlneni") ?? ""),
    priorita: String(fd.get("priorita") ?? "3"),
    zacatek: String(fd.get("zacatek") ?? ""),
    poznamka: String(fd.get("poznamka") ?? ""),
    odpovednaOsobaId: String(fd.get("odpovednaOsobaId") ?? ""),
  });
  if (!parsed.success) {
    const chyby: Record<string, string> = {};
    for (const i of parsed.error.issues) chyby[String(i.path[0])] = i.message;
    return { chyby };
  }
  const d = parsed.data;

  if (!(await jeOdpovednaPovolena(supabase, d.odpovednaOsobaId))) {
    return { chyby: { odpovednaOsobaId: "Odpovědnou osobou může být jen Projekťák nebo Vedoucí." } };
  }

  // Montáž / Demontáž se identifikuje popisem (název), který se zobrazuje všude.
  // Interní kód (parent · typ N) je jen jedinečný identifikátor a nemění se –
  // proto u nich pole „Název" upravuje popis a kontrola jedinečnosti kódu odpadá.
  const jeMontaz = !!(z as { montaz_typ: string | null }).montaz_typ;

  if (!jeMontaz) {
    const { data: kodExistuje } = await supabase
      .from("zakazky").select("id").eq("kod", d.kod).is("deleted_at", null).neq("id", zakazkaId).maybeSingle();
    if (kodExistuje) return { chyby: { kod: "Akce s tímto kódem už existuje." } };

    const { data: smazanaSKodem } = await supabase
      .from("zakazky").select("id, kod").eq("kod", d.kod).not("deleted_at", "is", null).neq("id", zakazkaId).maybeSingle();
    if (smazanaSKodem) {
      await supabase.from("zakazky")
        .update({ kod: `${smazanaSKodem.kod} (smazáno ${smazanaSKodem.id.slice(0, 6)})` })
        .eq("id", smazanaSKodem.id);
    }
  }

  if (parseDay(d.zacatek) > parseDay(z.konec_aktualni)) {
    return { chyby: { zacatek: "Začátek nesmí být po konci akce." } };
  }

  const zmenaKodu = jeMontaz
    ? { popis: d.kod } // u montáže/demontáže je „Název" = popis, kód zůstává
    : { kod: d.kod };

  const { error } = await supabase
    .from("zakazky")
    .update({
      ...zmenaKodu,
      misto_plneni: d.mistoPlneni,
      priorita: d.priorita,
      zacatek: d.zacatek,
      poznamka: d.poznamka || null,
      odpovedna_osoba_id: d.odpovednaOsobaId || null,
    })
    .eq("id", zakazkaId);
  if (error) {
    if (error.code === "23505") return { chyby: { kod: "Akce s tímto kódem už existuje." } };
    return { obecna: "Uložení se nezdařilo." };
  }

  // Přejmenování zakázky → přejmenuj i její automatický konstrukční projekt
  // (ten, který nesl původní číslo), aby v Konstrukci nezůstalo staré číslo.
  if (!jeMontaz && d.kod !== z.kod) {
    await supabase.from("projects").update({ name: d.kod }).eq("zakazka_id", zakazkaId).eq("name", z.kod);
  }

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
    puvodni: { kod: z.kod, mistoPlneni: z.misto_plneni, priorita: z.priorita },
    nova: { kod: d.kod, mistoPlneni: d.mistoPlneni, priorita: d.priorita },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky");
  revalidatePath("/konstrukce");
  redirect(`/zakazky/${zakazkaId}`);
}

export async function zmenitStav(
  zakazkaId: string,
  stav: "FAKTURACE" | "PROPLACENO" | "ARCHIV" | "AKTIVNI" | "POZASTAVENO",
) {
  const u = await writer();
  if (!u) return;
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, stav, fakturace_od, parent_id, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return;

  // fakturace_od = kdy akce vstoupila do stavu Fakturace (lhůta proplacení).
  // Nastaví se při přechodu na FAKTURACE (nepřepisuje se, když už tam je),
  // vynuluje se při návratu do výroby (AKTIVNI/POZASTAVENO).
  const uprava: { stav: typeof stav; archivovano_kdy: string | null; archivoval_id: string | null; fakturace_od?: string | null } = {
    stav,
    archivovano_kdy: stav === "ARCHIV" ? new Date().toISOString() : null,
    archivoval_id: stav === "ARCHIV" ? u.id : null,
  };
  if (stav === "FAKTURACE" && z.stav !== "FAKTURACE") {
    uprava.fakturace_od = z.fakturace_od ?? new Date().toISOString();
  } else if (stav === "AKTIVNI" || stav === "POZASTAVENO") {
    uprava.fakturace_od = null;
  }

  await supabase
    .from("zakazky")
    .update(uprava)
    .eq("id", zakazkaId);
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId,
    typZmeny: stav === "ARCHIV" ? "ARCHIVACE" : "UPRAVA",
    uzivatelId: u.id, puvodni: { stav: z.stav }, nova: { stav },
  });

  // Pozastavené zakázky k akci se při odchodu akce do fakturace / uzavření
  // VYJMOU z akce a povýší na samostatnou hlavní akci – dokončí se později
  // samostatně (zůstávají pozastavené, jejich lidé se neuvolňují).
  if (!z.parent_id && (stav === "FAKTURACE" || stav === "PROPLACENO" || stav === "ARCHIV")) {
    const { data: pozastavene } = await supabase
      .from("zakazky")
      .select("id, kod")
      .eq("parent_id", zakazkaId)
      .eq("stav", "POZASTAVENO")
      .is("deleted_at", null);
    for (const dite of pozastavene ?? []) {
      await supabase.from("zakazky").update({ parent_id: null }).eq("id", dite.id);
      // Konstrukce: podúkoly zakázky přesunout z projektu původní akce do
      // vlastního projektu povýšené akce (ať ji Konstrukce dál vidí).
      const { data: podukoly } = await supabase
        .from("tasks").select("id").eq("zakazka_id", dite.id).eq("status", "active");
      if (podukoly && podukoly.length > 0) {
        const { data: proj } = await supabase
          .from("projects")
          .insert({ zakazka_id: dite.id, name: dite.kod, owner_id: null })
          .select("id")
          .single();
        if (proj) {
          await supabase.from("tasks").update({ project_id: proj.id }).in("id", podukoly.map((t) => t.id));
        }
      }
      await zapisAudit(supabase, {
        entita: "zakazka", entitaId: dite.id, typZmeny: "UPRAVA", uzivatelId: u.id,
        nova: { popis: `Pozastavená zakázka vyjmuta z akce (ta přešla do stavu ${stav}) a povýšena na samostatnou akci` },
      });
      await zapisAudit(supabase, {
        entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
        nova: { popis: `Pozastavená zakázka ${dite.kod} vyjmuta z akce a povýšena na samostatnou akci` },
      });
    }
  }

  // Uvolnění dělníků při přechodu do fakturace: akce je hotová (občas dřív).
  // Pracovníkům se přiřazení UKONČÍ k dnešnímu dni (nemažou se – zůstávají
  // v evidenci, že na akci pracovali, dají se zpětně dohledat), ale zároveň
  // se uvolní termín, takže jdou hned nasadit jinam. U hlavní akce se to týká
  // i pracovníků na jejích zakázkách k akci (podzakázkách).
  if (stav === "FAKTURACE" && z.stav !== "FAKTURACE") {
    let cileIds = [zakazkaId];
    if (!z.parent_id) {
      const { data: deti } = await supabase
        .from("zakazky").select("id").eq("parent_id", zakazkaId).is("deleted_at", null);
      cileIds = [zakazkaId, ...(deti ?? []).map((d) => d.id)];
    }
    const dnes = formatDay(today());
    const ted = new Date().toISOString();

    // Kdo na akci reálně byl (pro záznam do historie) – před úpravou.
    const { data: zive } = await supabase
      .from("prirazeni_zakazka")
      .select("id, datum_od, osoba:profiles(name)")
      .in("zakazka_id", cileIds)
      .is("deleted_at", null);

    // Kdo ještě nezačal (termín je celý v budoucnu) – na akci nepracoval,
    // přiřazení se zruší úplně.
    await supabase
      .from("prirazeni_zakazka")
      .update({ deleted_at: ted })
      .in("zakazka_id", cileIds)
      .is("deleted_at", null)
      .gt("datum_od", dnes);
    // Kdo pracoval (začátek dnes nebo v minulosti) a přesahuje dnešek – konec
    // zkrátíme na dnešek: zůstává v evidenci, ale od zítřka je volný.
    await supabase
      .from("prirazeni_zakazka")
      .update({ datum_do: dnes })
      .in("zakazka_id", cileIds)
      .is("deleted_at", null)
      .gt("datum_do", dnes);

    const jmena = [
      ...new Set(
        (zive ?? [])
          .filter((p) => p.datum_od <= dnes)
          .map((p) => (p.osoba as unknown as { name: string } | null)?.name)
          .filter(Boolean),
      ),
    ];
    if (jmena.length > 0) {
      await zapisAudit(supabase, {
        entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
        nova: { popis: `Fakturace: pracovníci uvolněni (akce hotová), konec přiřazení k ${formatCz(today())} – zůstávají v evidenci: ${jmena.join(", ")}` },
      });
    }
  }

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky");
  revalidatePath("/zakazky/fakturace");
  revalidatePath("/zakazky/tabule");
  revalidatePath("/zakazky/plan");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/prehled");
  revalidatePath("/dilna/tabule");
}

export async function smazatZakazku(zakazkaId: string, _fd?: FormData) {
  const u = await writer();
  if (!u) return;
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, kod, stav, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return;

  const ted = new Date().toISOString();

  // Kaskáda na zakázky k akci: smazání akce vezme i její dceřiné zakázky,
  // ať v systému nezůstanou osiřelé (parent bez rodiče) záznamy.
  const { data: deti } = await supabase
    .from("zakazky").select("id").eq("parent_id", zakazkaId).is("deleted_at", null);
  const vsechnyIds = [zakazkaId, ...(deti ?? []).map((d) => d.id)];

  await supabase.from("prirazeni_zakazka").update({ deleted_at: ted }).in("zakazka_id", vsechnyIds).is("deleted_at", null);
  await supabase.from("milniky").update({ deleted_at: ted }).in("zakazka_id", vsechnyIds).is("deleted_at", null);

  // Konstrukce: zarchivovat projekty těchto zakázek + jejich úkoly, ať akce
  // po smazání nezůstane viset v Plánování/Ganttu.
  const { data: projs } = await supabase.from("projects").select("id").in("zakazka_id", vsechnyIds);
  const projIds = (projs ?? []).map((p) => p.id);
  if (projIds.length > 0) {
    await supabase
      .from("tasks")
      .update({ status: "archived", archived_at: ted, archived_by: u.id })
      .in("project_id", projIds)
      .eq("status", "active");
    await supabase.from("projects").update({ status: "archived" }).in("id", projIds).eq("status", "active");
  }
  // Úkoly reprezentující tyto zakázky k akci (žijí v projektu hlavní akce).
  await supabase
    .from("tasks")
    .update({ status: "archived", archived_at: ted, archived_by: u.id })
    .in("zakazka_id", vsechnyIds)
    .eq("status", "active");

  await supabase.from("zakazky").update({ deleted_at: ted }).in("id", vsechnyIds);

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "SMAZANI", uzivatelId: u.id,
    puvodni: { kod: z.kod, stav: z.stav },
  });
  revalidatePath("/zakazky");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/prehled");
  redirect("/zakazky");
}

// ---- Milníky --------------------------------------------------------------
type MilnikVstup = { typ: string; nazev?: string; datum: string; cas?: string; poznamka?: string };
type MilnikVysledek = { ok: boolean; chyba?: string };

export async function pridatMilnik(zakazkaId: string, vstup: MilnikVstup): Promise<MilnikVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();

  const parsed = milnikSchema.safeParse(vstup);
  if (!parsed.success) return { ok: false, chyba: parsed.error.issues[0]?.message ?? "Neplatné údaje." };
  const d = parsed.data;
  const nazev = d.nazev?.trim() || null;
  if (d.typ === "VLASTNI" && !nazev) return { ok: false, chyba: "Zadejte název milníku." };

  // Předvolený typ může být u akce jen jednou; vlastní (VLASTNI) se může opakovat.
  if (d.typ !== "VLASTNI") {
    const { data: existuje } = await supabase
      .from("milniky").select("id").eq("zakazka_id", zakazkaId).eq("typ", d.typ).is("deleted_at", null).maybeSingle();
    if (existuje) return { ok: false, chyba: "Tento typ milníku už u akce je." };
  }

  const { data: m, error } = await supabase
    .from("milniky")
    .insert({ zakazka_id: zakazkaId, typ: d.typ, nazev, datum: d.datum, cas: d.cas || null, poznamka: d.poznamka || null })
    .select("id")
    .single();
  if (error || !m) return { ok: false, chyba: "Uložení se nezdařilo." };

  await zapisAudit(supabase, { entita: "milnik", entitaId: m.id, typZmeny: "VYTVORENI", uzivatelId: u.id, nova: { typ: d.typ, nazev, datum: d.datum } });
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

export async function upravitMilnik(milnikId: string, vstup: MilnikVstup): Promise<MilnikVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();

  const { data: m } = await supabase
    .from("milniky").select("id, typ, zakazka_id, deleted_at").eq("id", milnikId).maybeSingle();
  if (!m || m.deleted_at) return { ok: false, chyba: "Milník nenalezen." };

  const parsed = milnikSchema.safeParse(vstup);
  if (!parsed.success) return { ok: false, chyba: parsed.error.issues[0]?.message ?? "Neplatné údaje." };
  const d = parsed.data;
  const nazev = d.nazev?.trim() || null;
  if (d.typ === "VLASTNI" && !nazev) return { ok: false, chyba: "Zadejte název milníku." };

  if (d.typ !== "VLASTNI" && d.typ !== m.typ) {
    const { data: kolize } = await supabase
      .from("milniky").select("id")
      .eq("zakazka_id", m.zakazka_id).eq("typ", d.typ).is("deleted_at", null).neq("id", milnikId).maybeSingle();
    if (kolize) return { ok: false, chyba: "Tento typ milníku už u akce je." };
  }

  await supabase.from("milniky")
    .update({ typ: d.typ, nazev, datum: d.datum, cas: d.cas || null, poznamka: d.poznamka || null })
    .eq("id", milnikId);
  await zapisAudit(supabase, { entita: "milnik", entitaId: milnikId, typZmeny: "UPRAVA", uzivatelId: u.id, nova: { typ: d.typ, nazev, datum: d.datum } });
  revalidatePath(`/zakazky/${m.zakazka_id}`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

export async function smazatMilnik(milnikId: string): Promise<MilnikVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();

  const { data: m } = await supabase
    .from("milniky").select("id, typ, zakazka_id, deleted_at").eq("id", milnikId).maybeSingle();
  if (!m || m.deleted_at) return { ok: false, chyba: "Milník nenalezen." };

  const ted = new Date().toISOString();
  await supabase.from("prirazeni_milnik").update({ deleted_at: ted }).eq("milnik_id", milnikId).is("deleted_at", null);
  await supabase.from("milniky").update({ deleted_at: ted }).eq("id", milnikId);
  await zapisAudit(supabase, { entita: "milnik", entitaId: milnikId, typZmeny: "SMAZANI", uzivatelId: u.id, puvodni: { typ: m.typ } });
  revalidatePath(`/zakazky/${m.zakazka_id}`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

// ---- Poznámky k akci ------------------------------------------------------
export async function pridatPoznamku(zakazkaId: string, text: string): Promise<{ ok: boolean; chyba?: string }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const t = text.trim();
  if (!t) return { ok: false, chyba: "Poznámka je prázdná." };
  const supabase = await createClient();
  const { data: z } = await supabase.from("zakazky").select("id, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { ok: false, chyba: "Akce nenalezena." };

  await supabase.from("akce_poznamky").insert({ zakazka_id: zakazkaId, uzivatel_id: u.id, text: t });
  revalidatePath(`/zakazky/${zakazkaId}`);
  return { ok: true };
}

export async function smazatPoznamku(poznamkaId: string): Promise<{ ok: boolean; chyba?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, chyba: "Nejste přihlášeni." };
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("akce_poznamky").select("id, zakazka_id, uzivatel_id, deleted_at").eq("id", poznamkaId).maybeSingle();
  if (!p || p.deleted_at) return { ok: false, chyba: "Poznámka nenalezena." };
  const jeAdmin = profile.role === "admin";
  if (p.uzivatel_id !== profile.id && !jeAdmin) return { ok: false, chyba: "Smazat může jen autor nebo správce." };

  await supabase.from("akce_poznamky").update({ deleted_at: new Date().toISOString() }).eq("id", poznamkaId);
  revalidatePath(`/zakazky/${p.zakazka_id}`);
  return { ok: true };
}

// ---- Montáž / Demontáž = zakázka k akci s příznakem typu -------------------
type MontazVstup = { typ: string; zakazkaRef?: string; popis?: string; od?: string; do?: string };

/**
 * Založí montáž/demontáž jako zakázku k akci (podzakázku) s montaz_typ – díky
 * tomu se objeví na Tabuli i v Ganttu a jde jí přiřazovat lidi jako každé
 * jiné zakázce k akci. Konstrukční podúkol se u ní NEzakládá.
 */
export async function pridatMontaz(
  parentId: string,
  vstup: MontazVstup,
): Promise<{ ok: boolean; chyba?: string; id?: string }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (vstup.typ !== "MONTAZ" && vstup.typ !== "DEMONTAZ") {
    return { ok: false, chyba: "Vyberte montáž nebo demontáž." };
  }
  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("zakazky")
    .select("id, kod, misto_plneni, zacatek, konec_aktualni, priorita, customer_id, deleted_at")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent || parent.deleted_at) return { ok: false, chyba: "Hlavní akce nenalezena." };

  const DEN = /^\d{4}-\d{2}-\d{2}$/;
  const zacatek = vstup.od && DEN.test(vstup.od) ? vstup.od : parent.zacatek;
  const konec = vstup.do && DEN.test(vstup.do) ? vstup.do : parent.konec_aktualni;
  if (zacatek > konec) return { ok: false, chyba: "Termín od nesmí být po termínu do." };

  const label = vstup.typ === "MONTAZ" ? "Montáž" : "Demontáž";
  const rucni = vstup.zakazkaRef?.trim();

  // Pořadové číslo montáže/demontáže dané akce (pro čitelný automatický kód).
  const { count } = await supabase
    .from("zakazky")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", parentId)
    .eq("montaz_typ", vstup.typ)
    .is("deleted_at", null);
  const zaklad = (count ?? 0) + 1;

  // Kód podzakázky: buď ruční (pole „Zakázka"), nebo čitelný automatický
  // („<akce> · Montáž 1"); při kolizi kódu zkusíme další pořadí.
  let child: { id: string } | null = null;
  for (let pokus = 0; pokus < 6 && !child; pokus++) {
    const auto = `${parent.kod} · ${label} ${zaklad + pokus}`;
    const kod = rucni ? (pokus === 0 ? rucni : `${rucni} (${pokus})`) : auto;
    const { data, error } = await supabase
      .from("zakazky")
      .insert({
        kod,
        misto_plneni: parent.misto_plneni,
        popis: vstup.popis?.trim() || label,
        priorita: parent.priorita,
        zacatek,
        konec_puvodni: konec,
        konec_aktualni: konec,
        parent_id: parentId,
        customer_id: parent.customer_id,
        montaz_typ: vstup.typ,
        zalozil_id: u.id,
      })
      .select("id")
      .single();
    if (!error && data) { child = data; break; }
    if (error?.code !== "23505") return { ok: false, chyba: "Uložení se nezdařilo." };
  }
  if (!child) return { ok: false, chyba: "Zakázka s tímto označením už existuje – zvol jiné." };

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: child.id, typZmeny: "VYTVORENI", uzivatelId: u.id,
    nova: { kod: rucni || label, montazTyp: vstup.typ, kAkci: parentId },
  });
  revalidatePath(`/zakazky/${parentId}`);
  revalidatePath("/zakazky");
  revalidatePath("/zakazky/tabule");
  revalidatePath("/zakazky/plan");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/prehled");
  return { ok: true, id: child.id };
}

export async function smazatMontaz(id: string): Promise<{ ok: boolean; chyba?: string }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nemáte právo zápisu." };
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("zakazky").select("id, parent_id, montaz_typ, deleted_at").eq("id", id).maybeSingle();
  if (!m || m.deleted_at || !m.montaz_typ) return { ok: false, chyba: "Záznam nenalezen." };

  const ted = new Date().toISOString();
  await supabase.from("prirazeni_zakazka").update({ deleted_at: ted }).eq("zakazka_id", id).is("deleted_at", null);
  await supabase.from("zakazky").update({ deleted_at: ted }).eq("id", id);
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: id, typZmeny: "SMAZANI", uzivatelId: u.id, puvodni: { montazTyp: m.montaz_typ },
  });
  if (m.parent_id) revalidatePath(`/zakazky/${m.parent_id}`);
  revalidatePath("/zakazky");
  revalidatePath("/zakazky/tabule");
  revalidatePath("/zakazky/plan");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/prehled");
  return { ok: true };
}

// ---- Přerušení / obnovení akce -------------------------------------------
/**
 * Přeruší jednu zakázku (bez kaskády): záznam do `preruseni` se zbývajícími
 * dny, stav POZASTAVENO, audit. Už přerušenou tiše přeskočí (kaskáda).
 */
async function prerusitJadro(supabase: Db, uid: string, zakazkaId: string, datumStr: string, duvod: string): Promise<void> {
  const { data: z } = await supabase
    .from("zakazky").select("id, konec_aktualni, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return;
  const { data: otevrene } = await supabase
    .from("preruseni").select("id").eq("zakazka_id", zakazkaId).is("datum_do", null).maybeSingle();
  if (otevrene) return;

  const zbyvajiciDny = Math.max(
    0,
    Math.round((parseDay(z.konec_aktualni).getTime() - parseDay(datumStr).getTime()) / 86400000),
  );
  await supabase.from("preruseni").insert({
    zakazka_id: zakazkaId, datum_od: datumStr, zbyvajici_dny: zbyvajiciDny, duvod, prerusil_id: uid,
  });
  await supabase.from("zakazky").update({ stav: "POZASTAVENO" }).eq("id", zakazkaId);
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: uid,
    nova: { preruseno: datumStr, duvod, zbyvajiciDny },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
}

/**
 * Obnoví jednu zakázku (bez kaskády): uzavře přerušení, posune konec o
 * zbývající dny, „celodélková" přiřazení protáhne na nový konec, audit.
 */
async function obnovitJadro(supabase: Db, uid: string, zakazkaId: string, datumStr: string): Promise<void> {
  const { data: z } = await supabase
    .from("zakazky").select("id, konec_aktualni, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return;
  const { data: preruseni } = await supabase
    .from("preruseni").select("id, zbyvajici_dny")
    .eq("zakazka_id", zakazkaId).is("datum_do", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!preruseni) return;

  const novyKonec = addDays(parseDay(datumStr), preruseni.zbyvajici_dny);
  const staryKonec = z.konec_aktualni;

  await supabase.from("preruseni")
    .update({ datum_do: datumStr, obnovil_id: uid }).eq("id", preruseni.id);
  await supabase.from("zakazky")
    .update({ stav: "AKTIVNI", konec_aktualni: formatDay(novyKonec) }).eq("id", zakazkaId);
  const { data: celodelkova } = await supabase
    .from("prirazeni_zakazka").select("id")
    .eq("zakazka_id", zakazkaId).is("deleted_at", null).eq("datum_do", staryKonec);
  for (const pr of celodelkova ?? []) {
    await supabase.from("prirazeni_zakazka").update({ datum_do: formatDay(novyKonec) }).eq("id", pr.id);
  }
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: uid,
    nova: { obnoveno: datumStr, novyKonec: formatDay(novyKonec) },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
}

/** Aktivní podzakázky akce (pro kaskádu přerušení/obnovení). */
async function idsPodzakazek(supabase: Db, zakazkaId: string, stav: "AKTIVNI" | "POZASTAVENO"): Promise<string[]> {
  const { data } = await supabase
    .from("zakazky").select("id").eq("parent_id", zakazkaId).eq("stav", stav).is("deleted_at", null);
  return (data ?? []).map((r) => r.id);
}

export async function prerusitAkci(zakazkaId: string, _prev: ZakazkaStav, fd: FormData): Promise<ZakazkaStav> {
  const u = await writer();
  if (!u) return { obecna: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { obecna: "Akce nenalezena." };

  const datumStr = String(fd.get("datumOd") ?? "");
  const duvod = String(fd.get("duvod") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datumStr)) return { chyby: { datumOd: "Zadejte datum přerušení." } };
  if (duvod.length < 3) return { chyby: { duvod: "Uveďte důvod přerušení." } };

  const { data: otevrene } = await supabase
    .from("preruseni").select("id").eq("zakazka_id", zakazkaId).is("datum_do", null).maybeSingle();
  if (otevrene) return { obecna: "Akce už je přerušená." };

  await prerusitJadro(supabase, u.id, zakazkaId, datumStr, duvod);
  // Kaskáda: s akcí se pozastaví i všechny její aktivní zakázky k akci.
  for (const id of await idsPodzakazek(supabase, zakazkaId, "AKTIVNI")) {
    await prerusitJadro(supabase, u.id, id, datumStr, `S hlavní akcí: ${duvod}`);
  }
  revalidatePath("/zakazky");
  revalidatePath("/zakazky/tabule");
  revalidatePath("/zakazky/plan");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/prehled");
  return {};
}

export async function obnovitAkci(zakazkaId: string, _prev: ZakazkaStav, fd: FormData): Promise<ZakazkaStav> {
  const u = await writer();
  if (!u) return { obecna: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { obecna: "Akce nenalezena." };

  const datumStr = String(fd.get("datumObnoveni") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datumStr)) return { chyby: { datumObnoveni: "Zadejte datum obnovení." } };

  const { data: preruseni } = await supabase
    .from("preruseni").select("id")
    .eq("zakazka_id", zakazkaId).is("datum_do", null).maybeSingle();
  if (!preruseni) return { obecna: "Akce není přerušená." };

  await obnovitJadro(supabase, u.id, zakazkaId, datumStr);
  // Kaskáda: obnoví se i pozastavené zakázky k akci (mají-li otevřené přerušení).
  for (const id of await idsPodzakazek(supabase, zakazkaId, "POZASTAVENO")) {
    await obnovitJadro(supabase, u.id, id, datumStr);
  }
  revalidatePath("/zakazky");
  revalidatePath("/zakazky/tabule");
  revalidatePath("/zakazky/plan");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/prehled");
  return {};
}

// ---- Správa pracovníků u existující akce ---------------------------------
export type PracVysledek = { ok: boolean; chyba?: string; potrebaPotvrzeni?: string };
const DEN_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Má osoba v období schválenou dovolenou? Vrátí popis, jinak null. */
async function dovolenaVObdobi(supabase: Db, osobaId: string, od: Date, doD: Date): Promise<string | null> {
  const { data } = await supabase
    .from("absences")
    .select("start_date, end_date")
    .eq("profile_id", osobaId)
    .eq("type", "dovolena")
    .lte("start_date", formatDay(doD))
    .gte("end_date", formatDay(od))
    .limit(1);
  const a = (data ?? [])[0];
  if (!a) return null;
  return `má dovolenou ${formatCz(parseDay(a.start_date))} – ${formatCz(parseDay(a.end_date))}`;
}

async function konfliktPracovnika(
  supabase: Db,
  osobaId: string,
  od: Date,
  doD: Date,
  excludeId?: string,
): Promise<string | null> {
  // Přiřazení na POZASTAVENÝCH akcích neblokují – lidé z pozastavené akce
  // jdou použít jinde (u akce ale zůstávají napsaní pro pozdější obnovení).
  let q = supabase
    .from("prirazeni_zakazka")
    .select("id, datum_od, datum_do, zakazka:zakazky!inner(kod, deleted_at, stav)")
    .eq("osoba_id", osobaId)
    .is("deleted_at", null)
    .is("zakazka.deleted_at", null)
    .neq("zakazka.stav", "POZASTAVENO")
    .lte("datum_od", formatDay(doD))
    .gte("datum_do", formatDay(od))
    .limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  const e = (data ?? [])[0] as unknown as
    | { datum_od: string; datum_do: string; zakazka: { kod: string } }
    | undefined;
  if (!e) return null;
  return `obsazen(a) u akce ${e.zakazka.kod} (${formatCz(parseDay(e.datum_od))} – ${formatCz(parseDay(e.datum_do))})`;
}

export async function pridatPracovnika(
  zakazkaId: string, osobaId: string, od: string, doStr: string, duvod: string, vynutit = false,
): Promise<PracVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (!osobaId) return { ok: false, chyba: "Vyberte pracovníka." };
  if (duvod.trim().length < 3) return { ok: false, chyba: "Uveďte důvod." };
  if (!DEN_RE.test(od) || !DEN_RE.test(doStr)) return { ok: false, chyba: "Zadejte termín od–do." };
  const odD = parseDay(od), doD = parseDay(doStr);
  if (odD > doD) return { ok: false, chyba: "Datum od nesmí být po datu do." };
  const supabase = await createClient();

  const { data: z } = await supabase.from("zakazky").select("id, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { ok: false, chyba: "Akce nenalezena." };
  const { data: osoba } = await supabase.from("profiles").select("name").eq("id", osobaId).maybeSingle();
  const jmeno = osoba?.name ?? "pracovník";

  // Dovolená blokuje natvrdo (nejde vynutit) – pracovník na dovolené se nepřiřazuje.
  const dovolena = await dovolenaVObdobi(supabase, osobaId, odD, doD);
  if (dovolena) return { ok: false, chyba: `${jmeno} ${dovolena} – v tomto období ho nelze přiřadit k akci.` };

  const konflikt = await konfliktPracovnika(supabase, osobaId, odD, doD);
  if (konflikt && !vynutit) {
    return { ok: false, potrebaPotvrzeni: `${jmeno} je ${konflikt}. Přidat i tak? Zapíše se do historie.` };
  }

  await supabase.from("prirazeni_zakazka").insert({
    zakazka_id: zakazkaId, osoba_id: osobaId, datum_od: od, datum_do: doStr,
  });
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
    nova: { popis: `Přidán pracovník ${jmeno} (${formatCz(odD)} – ${formatCz(doD)}) — důvod: ${duvod}${konflikt ? " [POTVRZENO i přes obsazení]" : ""}` },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath(`/zakazky/${zakazkaId}/upravit`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

/**
 * Zjistí kolize při přidání pracovníka na akci (na celé období akce) BEZ zápisu –
 * pro kolizní dialog s náhradníky na Tabuli. Stejná logika jako u zakládání akce.
 */
export async function zjistitKoliziPridani(
  zakazkaId: string,
  osobaId: string,
): Promise<{ ok: boolean; chyba?: string; kolize?: KolizeInfo[] }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (!osobaId) return { ok: false, chyba: "Chybí osoba." };
  const supabase = await createClient();

  const { data: z } = await supabase
    .from("zakazky").select("id, zacatek, konec_aktualni, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { ok: false, chyba: "Akce nenalezena." };

  const novy = { datumOd: parseDay(z.zacatek), datumDo: parseDay(z.konec_aktualni) };
  const existujici = await nactiExistujiciPrirazeni(supabase, [osobaId]);
  const kandidati: ExistujiciPrirazeni[] = existujici
    .filter((e) => e.osoba_id === osobaId)
    .map((e) => ({
      id: e.id,
      zakazkaId: e.zakazka_id,
      zakazkaKod: e.zakazka.kod,
      datumOd: parseDay(e.datum_od),
      datumDo: parseDay(e.datum_do),
    }));

  const kolize: KolizeInfo[] = [];
  for (const k of najdiKolize(novy, kandidati)) {
    const navrh = navrhniReseni(novy, k);
    const os = existujici.find((e) => e.id === k.id)!.osoba;
    const prekrOd = navrh.obdobiProNahradnika.datumOd;
    const prekrDo = navrh.obdobiProNahradnika.datumDo;

    const { data: obsazeniRaw } = await supabase
      .from("prirazeni_zakazka")
      .select("osoba_id, datum_od, datum_do, zakazka:zakazky!inner(deleted_at)")
      .is("deleted_at", null)
      .is("zakazka.deleted_at", null)
      .lte("datum_od", formatDay(prekrDo))
      .gte("datum_do", formatDay(prekrOd));
    const obsazeni = (obsazeniRaw ?? []).map((o) => ({
      osobaId: o.osoba_id,
      od: formatCz(parseDay(o.datum_od)),
      do: formatCz(parseDay(o.datum_do)),
    }));

    kolize.push({
      osobaId,
      osobaJmeno: os?.name ?? "?",
      prirazeniId: k.id,
      zakazkaId: k.zakazkaId,
      zakazkaKod: k.zakazkaKod,
      od: formatDay(k.datumOd),
      do: formatDay(k.datumDo),
      novyOd: formatDay(novy.datumOd),
      novyDo: formatDay(novy.datumDo),
      predOd: navrh.castPred ? formatDay(navrh.castPred.datumOd) : null,
      predDo: navrh.castPred ? formatDay(navrh.castPred.datumDo) : null,
      poOd: navrh.castPo ? formatDay(navrh.castPo.datumOd) : null,
      poDo: navrh.castPo ? formatDay(navrh.castPo.datumDo) : null,
      nahradnikOd: formatDay(navrh.obdobiProNahradnika.datumOd),
      nahradnikDo: formatDay(navrh.obdobiProNahradnika.datumDo),
      obsazeni,
    });
  }

  return { ok: true, kolize };
}

export async function odebratPracovnika(prirazeniId: string, duvod: string): Promise<PracVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (duvod.trim().length < 3) return { ok: false, chyba: "Uveďte důvod." };
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("prirazeni_zakazka")
    .select("id, zakazka_id, datum_od, datum_do, deleted_at, osoba:profiles(name, oddeleni)")
    .eq("id", prirazeniId)
    .maybeSingle();
  if (!p || p.deleted_at) return { ok: false, chyba: "Přiřazení nenalezeno." };
  const osoba = p.osoba as unknown as { name: string; oddeleni: string | null } | null;
  const jmeno = osoba?.name ?? "?";

  // Odebrat konstruktéra ze zakázky smí jen šéfkonstruktér nebo administrátor.
  if (osoba?.oddeleni === "konstrukce" && !muzeOdebratKonstruktera(u)) {
    return { ok: false, chyba: "Odebrat konstruktéra ze zakázky smí jen šéfkonstruktér nebo administrátor." };
  }

  await supabase.from("prirazeni_zakazka").update({ deleted_at: new Date().toISOString() }).eq("id", p.id);
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: p.zakazka_id, typZmeny: "UPRAVA", uzivatelId: u.id,
    nova: { popis: `Odebrán pracovník ${jmeno} (${formatCz(parseDay(p.datum_od))} – ${formatCz(parseDay(p.datum_do))}) — důvod: ${duvod}` },
  });
  revalidatePath(`/zakazky/${p.zakazka_id}`);
  revalidatePath(`/zakazky/${p.zakazka_id}/upravit`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

/**
 * Nastaví (nebo zruší) odpovědnou osobu zakázky – z tabule přetažením
 * projekťáka / vedoucího. Odpovědnou osobou smí být jen Projekťák nebo Vedoucí.
 */
export async function nastavitOdpovednouOsobu(zakazkaId: string, osobaId: string | null): Promise<PracVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();

  const { data: z } = await supabase.from("zakazky").select("id, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { ok: false, chyba: "Akce nenalezena." };

  let jmeno = "—";
  if (osobaId) {
    const { data: osoba } = await supabase
      .from("profiles").select("name, oddeleni, role, active").eq("id", osobaId).maybeSingle();
    if (!osoba || !osoba.active) return { ok: false, chyba: "Osoba nenalezena." };
    if (osoba.oddeleni !== "projektak" && osoba.role !== "vedouci") {
      return { ok: false, chyba: "Odpovědnou osobou může být jen Projekťák nebo Vedoucí." };
    }
    jmeno = osoba.name;
  }

  const { error } = await supabase.from("zakazky").update({ odpovedna_osoba_id: osobaId }).eq("id", zakazkaId);
  if (error) return { ok: false, chyba: "Uložení se nezdařilo." };
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
    nova: { popis: osobaId ? `Odpovědná osoba: ${jmeno}` : "Odpovědná osoba zrušena" },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath(`/zakazky/${zakazkaId}/upravit`);
  revalidatePath("/zakazky/tabule");
  revalidatePath("/zakazky/plan");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/prehled");
  return { ok: true };
}

export async function zmenitTerminPracovnika(
  prirazeniId: string, od: string, doStr: string, duvod: string, vynutit = false,
): Promise<PracVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (duvod.trim().length < 3) return { ok: false, chyba: "Uveďte důvod." };
  if (!DEN_RE.test(od) || !DEN_RE.test(doStr)) return { ok: false, chyba: "Zadejte termín od–do." };
  const odD = parseDay(od), doD = parseDay(doStr);
  if (odD > doD) return { ok: false, chyba: "Datum od nesmí být po datu do." };
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("prirazeni_zakazka")
    .select("id, zakazka_id, osoba_id, datum_od, datum_do, deleted_at, osoba:profiles(name)")
    .eq("id", prirazeniId)
    .maybeSingle();
  if (!p || p.deleted_at) return { ok: false, chyba: "Přiřazení nenalezeno." };

  const jmeno = (p.osoba as unknown as { name: string } | null)?.name ?? "?";
  const dovolenaT = await dovolenaVObdobi(supabase, p.osoba_id, odD, doD);
  if (dovolenaT) return { ok: false, chyba: `${jmeno} ${dovolenaT} – termín do dovolené nastavit nejde.` };

  const konflikt = await konfliktPracovnika(supabase, p.osoba_id, odD, doD, p.id);
  if (konflikt && !vynutit) {
    return { ok: false, potrebaPotvrzeni: `${jmeno} je ${konflikt}. Změnit termín i tak? Zapíše se do historie.` };
  }

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: p.zakazka_id, typZmeny: "UPRAVA", uzivatelId: u.id,
    nova: { popis: `Změněn termín pracovníka ${jmeno}: ${formatCz(parseDay(p.datum_od))}–${formatCz(parseDay(p.datum_do))} → ${formatCz(odD)}–${formatCz(doD)} — důvod: ${duvod}${konflikt ? " [POTVRZENO i přes obsazení]" : ""}` },
  });
  await supabase.from("prirazeni_zakazka").update({ datum_od: od, datum_do: doStr }).eq("id", p.id);
  revalidatePath(`/zakazky/${p.zakazka_id}`);
  revalidatePath(`/zakazky/${p.zakazka_id}/upravit`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

export async function nahraditPracovnika(
  prirazeniId: string, novaOsobaId: string, duvod: string, vynutit = false,
): Promise<PracVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (!novaOsobaId) return { ok: false, chyba: "Vyberte náhradu." };
  if (duvod.trim().length < 3) return { ok: false, chyba: "Uveďte důvod." };
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("prirazeni_zakazka")
    .select("id, zakazka_id, osoba_id, datum_od, datum_do, deleted_at, osoba:profiles(name)")
    .eq("id", prirazeniId)
    .maybeSingle();
  if (!p || p.deleted_at) return { ok: false, chyba: "Přiřazení nenalezeno." };
  if (novaOsobaId === p.osoba_id) return { ok: false, chyba: "Vyberte jinou osobu." };
  const { data: nova } = await supabase.from("profiles").select("name").eq("id", novaOsobaId).maybeSingle();
  const novaJmeno = nova?.name ?? "náhrada";
  const puvodniJmeno = (p.osoba as unknown as { name: string } | null)?.name ?? "?";

  const dovolenaN = await dovolenaVObdobi(supabase, novaOsobaId, parseDay(p.datum_od), parseDay(p.datum_do));
  if (dovolenaN) return { ok: false, chyba: `${novaJmeno} ${dovolenaN} – nelze nasadit jako náhradu.` };

  const konflikt = await konfliktPracovnika(supabase, novaOsobaId, parseDay(p.datum_od), parseDay(p.datum_do), p.id);
  if (konflikt && !vynutit) {
    return { ok: false, potrebaPotvrzeni: `${novaJmeno} je ${konflikt}. Nahradit i tak? Zapíše se do historie.` };
  }

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: p.zakazka_id, typZmeny: "UPRAVA", uzivatelId: u.id,
    nova: { popis: `Nahrazen pracovník ${puvodniJmeno} → ${novaJmeno} (${formatCz(parseDay(p.datum_od))} – ${formatCz(parseDay(p.datum_do))}) — důvod: ${duvod}${konflikt ? " [POTVRZENO i přes obsazení]" : ""}` },
  });
  await supabase.from("prirazeni_zakazka").update({ osoba_id: novaOsobaId }).eq("id", p.id);
  revalidatePath(`/zakazky/${p.zakazka_id}`);
  revalidatePath(`/zakazky/${p.zakazka_id}/upravit`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

// ---- Posun akce tažením v plánu (drag & drop) ------------------------------
export type PosunVysledek = { ok: boolean; chyba?: string };

/**
 * mode "move":  posune celou akci o deltaDays (začátek, konec, přiřazení
 *               i milníky); změna konce se zapíše do historie prodloužení.
 * mode "resize": změní jen konec (stejná pravidla jako prodlouzit).
 * Důvod je povinný – změna termínu je auditovaná operace.
 */
export async function posunoutAkci(
  zakazkaId: string,
  mode: "move" | "resize",
  deltaDays: number,
  duvod: string,
): Promise<PosunVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (!Number.isInteger(deltaDays) || deltaDays === 0) return { ok: false, chyba: "Nulový posun." };
  if (Math.abs(deltaDays) > 365) return { ok: false, chyba: "Posun je příliš velký." };
  if (duvod.trim().length < 3) return { ok: false, chyba: "Uveďte důvod." };
  const supabase = await createClient();

  const { data: z } = await supabase
    .from("zakazky")
    .select("id, kod, zacatek, konec_aktualni, deleted_at")
    .eq("id", zakazkaId)
    .maybeSingle();
  if (!z || z.deleted_at) return { ok: false, chyba: "Akce nenalezena." };

  const staryZacatek = parseDay(z.zacatek);
  const staryKonec = parseDay(z.konec_aktualni);
  const novyKonec = addDays(staryKonec, deltaDays);

  if (mode === "resize") {
    if (novyKonec < staryZacatek) return { ok: false, chyba: "Konec nesmí být před začátkem akce." };
    // stejná logika jako prodlouzit()
    await supabase.from("prodlouzeni").insert({
      zakazka_id: z.id,
      stary_konec: formatDay(staryKonec),
      novy_konec: formatDay(novyKonec),
      duvod,
      provedl_id: u.id,
    });
    await supabase.from("zakazky").update({ konec_aktualni: formatDay(novyKonec) }).eq("id", z.id);

    if (novyKonec < staryKonec) {
      const { data: presahujici } = await supabase
        .from("prirazeni_zakazka").select("id")
        .eq("zakazka_id", z.id).is("deleted_at", null)
        .lte("datum_od", formatDay(novyKonec)).gt("datum_do", formatDay(novyKonec));
      for (const pr of presahujici ?? []) {
        await supabase.from("prirazeni_zakazka").update({ datum_do: formatDay(novyKonec) }).eq("id", pr.id);
      }
      const { data: zaKoncem } = await supabase
        .from("prirazeni_zakazka").select("id")
        .eq("zakazka_id", z.id).is("deleted_at", null).gt("datum_od", formatDay(novyKonec));
      for (const pr of zaKoncem ?? []) {
        await supabase.from("prirazeni_zakazka").update({ deleted_at: new Date().toISOString() }).eq("id", pr.id);
      }
    } else {
      const { data: celodelkova } = await supabase
        .from("prirazeni_zakazka").select("id")
        .eq("zakazka_id", z.id).is("deleted_at", null).eq("datum_do", formatDay(staryKonec));
      for (const pr of celodelkova ?? []) {
        await supabase.from("prirazeni_zakazka").update({ datum_do: formatDay(novyKonec) }).eq("id", pr.id);
      }
    }

    await zapisAudit(supabase, {
      entita: "zakazka", entitaId: z.id, typZmeny: "PRODLOUZENI", uzivatelId: u.id,
      puvodni: { konec: formatDay(staryKonec) },
      nova: { konec: formatDay(novyKonec), duvod, popis: `Konec změněn tažením v plánu o ${deltaDays} dní — důvod: ${duvod}` },
    });
  } else {
    // move: posun celé akce včetně přiřazení a milníků
    const novyZacatek = addDays(staryZacatek, deltaDays);

    await supabase.from("prodlouzeni").insert({
      zakazka_id: z.id,
      stary_konec: formatDay(staryKonec),
      novy_konec: formatDay(novyKonec),
      duvod: `Posun celé akce o ${deltaDays} dní — ${duvod}`,
      provedl_id: u.id,
    });
    await supabase
      .from("zakazky")
      .update({ zacatek: formatDay(novyZacatek), konec_aktualni: formatDay(novyKonec) })
      .eq("id", z.id);

    const { data: prirazeni } = await supabase
      .from("prirazeni_zakazka").select("id, datum_od, datum_do")
      .eq("zakazka_id", z.id).is("deleted_at", null);
    for (const p of prirazeni ?? []) {
      await supabase.from("prirazeni_zakazka").update({
        datum_od: formatDay(addDays(parseDay(p.datum_od), deltaDays)),
        datum_do: formatDay(addDays(parseDay(p.datum_do), deltaDays)),
      }).eq("id", p.id);
    }
    const { data: milniky } = await supabase
      .from("milniky").select("id, datum")
      .eq("zakazka_id", z.id).is("deleted_at", null);
    for (const m of milniky ?? []) {
      await supabase.from("milniky").update({
        datum: formatDay(addDays(parseDay(m.datum), deltaDays)),
      }).eq("id", m.id);
    }

    await zapisAudit(supabase, {
      entita: "zakazka", entitaId: z.id, typZmeny: "UPRAVA", uzivatelId: u.id,
      puvodni: { zacatek: formatDay(staryZacatek), konec: formatDay(staryKonec) },
      nova: {
        zacatek: formatDay(novyZacatek), konec: formatDay(novyKonec),
        popis: `Akce posunuta tažením v plánu o ${deltaDays} dní (vč. přiřazení a milníků) — důvod: ${duvod}`,
      },
    });
  }

  revalidatePath("/zakazky");
  revalidatePath(`/zakazky/${z.id}`);
  revalidatePath("/zakazky/plan");
  return { ok: true };
}

// ---- Tlačítko pauza/obnovení (⏸/▶) -----------------------------------------

export type ObnovaKonflikt = {
  prirazeniId: string;
  osobaId: string;
  jmeno: string;
  /** kde je na obnovované akci napsán (kod akce / zakázky k akci) */
  zakazkaKod: string;
  od: string;
  do: string;
  /** popis obsazení jinde („obsazen(a) u akce …") */
  konflikt: string;
};

/** Pozastaví akci tlačítkem ⏸ (datum + důvod z dialogu, kaskáda na podzakázky). */
export async function pauzaAkce(zakazkaId: string, datumOd: string, duvod: string): Promise<PracVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (!DEN_RE.test(datumOd)) return { ok: false, chyba: "Zadejte datum pozastavení." };
  if (duvod.trim().length < 3) return { ok: false, chyba: "Uveďte důvod pozastavení." };
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, stav, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { ok: false, chyba: "Akce nenalezena." };
  if (z.stav !== "AKTIVNI") return { ok: false, chyba: "Pozastavit jde jen aktivní akci." };

  await prerusitJadro(supabase, u.id, zakazkaId, datumOd, duvod.trim());
  for (const id of await idsPodzakazek(supabase, zakazkaId, "AKTIVNI")) {
    await prerusitJadro(supabase, u.id, id, datumOd, `S hlavní akcí: ${duvod.trim()}`);
  }
  revalidatePath("/zakazky");
  revalidatePath("/zakazky/tabule");
  revalidatePath("/zakazky/plan");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/prehled");
  return { ok: true };
}

/**
 * Před obnovením: lidé napsaní na akci (i podzakázkách), kteří jsou mezitím
 * obsazení na jiné aktivní akci v překrývajícím se období. Pro dialog náhrad.
 */
export async function zjistitKonfliktyObnoveni(
  zakazkaId: string,
): Promise<{ ok: boolean; chyba?: string; konflikty?: ObnovaKonflikt[] }> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();
  const { data: rodinaData } = await supabase
    .from("zakazky").select("id").or(`id.eq.${zakazkaId},parent_id.eq.${zakazkaId}`).is("deleted_at", null);
  const rodina = (rodinaData ?? []).map((r) => r.id);
  if (!rodina.includes(zakazkaId)) return { ok: false, chyba: "Akce nenalezena." };

  const { data: prirData } = await supabase
    .from("prirazeni_zakazka")
    .select("id, osoba_id, datum_od, datum_do, osoba:profiles(name), zakazka:zakazky!inner(kod)")
    .in("zakazka_id", rodina)
    .is("deleted_at", null);
  const prirazeni = (prirData ?? []) as unknown as {
    id: string; osoba_id: string; datum_od: string; datum_do: string;
    osoba: { name: string } | null; zakazka: { kod: string };
  }[];

  const konflikty: ObnovaKonflikt[] = [];
  for (const p of prirazeni) {
    const konflikt = await konfliktPracovnika(supabase, p.osoba_id, parseDay(p.datum_od), parseDay(p.datum_do), p.id);
    if (konflikt) {
      konflikty.push({
        prirazeniId: p.id,
        osobaId: p.osoba_id,
        jmeno: p.osoba?.name ?? "?",
        zakazkaKod: p.zakazka.kod,
        od: p.datum_od,
        do: p.datum_do,
        konflikt,
      });
    }
  }
  return { ok: true, konflikty };
}

/** Přiřaditelné aktivní osoby pro výběr náhradníka v dialogu obnovení. */
export async function seznamNahradniku(): Promise<{ id: string; name: string; oddeleni: string | null }[]> {
  const u = await writer();
  if (!u) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, oddeleni")
    .eq("active", true)
    .eq("assignable", true)
    .order("name");
  return ((data ?? []) as { id: string; name: string; oddeleni: string | null }[]).sort((a, b) =>
    porovnatDlePrijmeni(a.name, b.name),
  );
}

/**
 * Obnoví akci tlačítkem ▶ (kaskáda na podzakázky). `nahrady` z dialogu:
 * u konfliktních lidí vymění osobu na přiřazení za vybraného náhradníka
 * (období zůstává), zbytek se jen obnoví.
 */
export async function obnovaAkce(
  zakazkaId: string,
  datumObnoveni: string,
  nahrady: { prirazeniId: string; novaOsobaId: string }[],
): Promise<PracVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (!DEN_RE.test(datumObnoveni)) return { ok: false, chyba: "Zadejte datum obnovení." };
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, stav, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { ok: false, chyba: "Akce nenalezena." };
  if (z.stav !== "POZASTAVENO") return { ok: false, chyba: "Obnovit jde jen pozastavenou akci." };

  // Náhrady před obnovením (rozhodnuté v dialogu – bez další kolizní kontroly).
  for (const n of nahrady) {
    if (!n.novaOsobaId) continue;
    const { data: p } = await supabase
      .from("prirazeni_zakazka")
      .select("id, zakazka_id, osoba_id, datum_od, datum_do, deleted_at, osoba:profiles(name)")
      .eq("id", n.prirazeniId)
      .maybeSingle();
    if (!p || p.deleted_at) continue;
    if (p.osoba_id === n.novaOsobaId) continue;
    const { data: nova } = await supabase.from("profiles").select("name").eq("id", n.novaOsobaId).maybeSingle();
    const dovN = await dovolenaVObdobi(supabase, n.novaOsobaId, parseDay(p.datum_od), parseDay(p.datum_do));
    if (dovN) return { ok: false, chyba: `${nova?.name ?? "Náhradník"} ${dovN} – nelze nasadit jako náhradu.` };
    const puvodniJmeno = (p.osoba as unknown as { name: string } | null)?.name ?? "?";
    await supabase.from("prirazeni_zakazka").update({ osoba_id: n.novaOsobaId }).eq("id", p.id);
    await zapisAudit(supabase, {
      entita: "zakazka", entitaId: p.zakazka_id, typZmeny: "UPRAVA", uzivatelId: u.id,
      nova: { popis: `Náhrada při obnovení akce: ${puvodniJmeno} → ${nova?.name ?? "?"} (${formatCz(parseDay(p.datum_od))} – ${formatCz(parseDay(p.datum_do))})` },
    });
  }

  const { data: preruseni } = await supabase
    .from("preruseni").select("id").eq("zakazka_id", zakazkaId).is("datum_do", null).maybeSingle();
  if (preruseni) {
    await obnovitJadro(supabase, u.id, zakazkaId, datumObnoveni);
  } else {
    // Pozastaveno bez záznamu přerušení (změna stavu) → jen vrátit stav.
    await supabase.from("zakazky").update({ stav: "AKTIVNI" }).eq("id", zakazkaId);
    await zapisAudit(supabase, {
      entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
      nova: { popis: `Akce obnovena (bez záznamu přerušení)` },
    });
  }
  for (const id of await idsPodzakazek(supabase, zakazkaId, "POZASTAVENO")) {
    await obnovitJadro(supabase, u.id, id, datumObnoveni);
  }
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky");
  revalidatePath("/zakazky/tabule");
  revalidatePath("/zakazky/plan");
  revalidatePath("/konstrukce");
  revalidatePath("/konstrukce/gantt");
  revalidatePath("/konstrukce/prehled");
  return { ok: true };
}
