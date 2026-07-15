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
import { canWrite, type Role, type TypZmeny } from "@erp/core";
import {
  zakazkaSchema,
  zakazkaUpravaSchema,
  prodlouzeniSchema,
  milnikSchema,
} from "@/lib/zakazky/validations";
import { parseDay, formatDay, formatCz, dayBefore, addDays } from "@/lib/zakazky/dates";
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
  return { id: profile.id, name: profile.name, role: profile.role as Role };
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
    prirazeni,
  };
}

/** Všechna živá přiřazení daných osob (join na kód zakázky a jméno osoby). */
async function nactiExistujiciPrirazeni(supabase: Db, osobaIds: string[]) {
  const { data } = await supabase
    .from("prirazeni_zakazka")
    .select("id, zakazka_id, osoba_id, datum_od, datum_do, zakazka:zakazky!inner(kod, deleted_at), osoba:profiles(name)")
    .in("osoba_id", osobaIds)
    .is("deleted_at", null)
    .is("zakazka.deleted_at", null);
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

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazka.id, typZmeny: "VYTVORENI", uzivatelId: u.id,
    nova: { kod: d.kod, ...(d.inquiryId ? { zPoptavky: d.inquiryId } : {}) },
  });
  revalidatePath("/zakazky");
  redirect(`/zakazky/${zakazka.id}`);
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
    .select("id, kod, misto_plneni, priorita, konec_aktualni, deleted_at")
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

  if (parseDay(d.zacatek) > parseDay(z.konec_aktualni)) {
    return { chyby: { zacatek: "Začátek nesmí být po konci akce." } };
  }

  const { error } = await supabase
    .from("zakazky")
    .update({
      kod: d.kod,
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

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
    puvodni: { kod: z.kod, mistoPlneni: z.misto_plneni, priorita: z.priorita },
    nova: { kod: d.kod, mistoPlneni: d.mistoPlneni, priorita: d.priorita },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky");
  redirect(`/zakazky/${zakazkaId}`);
}

export async function zmenitStav(
  zakazkaId: string,
  stav: "DOKONCENO" | "ARCHIV" | "AKTIVNI" | "POZASTAVENO",
) {
  const u = await writer();
  if (!u) return;
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, stav, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return;

  await supabase
    .from("zakazky")
    .update({
      stav,
      archivovano_kdy: stav === "ARCHIV" ? new Date().toISOString() : null,
      archivoval_id: stav === "ARCHIV" ? u.id : null,
    })
    .eq("id", zakazkaId);
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId,
    typZmeny: stav === "ARCHIV" ? "ARCHIVACE" : "UPRAVA",
    uzivatelId: u.id, puvodni: { stav: z.stav }, nova: { stav },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky");
}

export async function smazatZakazku(zakazkaId: string, _fd?: FormData) {
  const u = await writer();
  if (!u) return;
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, kod, stav, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return;

  const ted = new Date().toISOString();
  await supabase.from("prirazeni_zakazka").update({ deleted_at: ted }).eq("zakazka_id", zakazkaId).is("deleted_at", null);
  await supabase.from("milniky").update({ deleted_at: ted }).eq("zakazka_id", zakazkaId).is("deleted_at", null);
  await supabase.from("zakazky").update({ deleted_at: ted }).eq("id", zakazkaId);

  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "SMAZANI", uzivatelId: u.id,
    puvodni: { kod: z.kod, stav: z.stav },
  });
  revalidatePath("/zakazky");
  redirect("/zakazky");
}

// ---- Milníky --------------------------------------------------------------
type MilnikVstup = { typ: string; datum: string; cas?: string; poznamka?: string };
type MilnikVysledek = { ok: boolean; chyba?: string };

export async function pridatMilnik(zakazkaId: string, vstup: MilnikVstup): Promise<MilnikVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();

  const parsed = milnikSchema.safeParse(vstup);
  if (!parsed.success) return { ok: false, chyba: parsed.error.issues[0]?.message ?? "Neplatné údaje." };
  const d = parsed.data;

  const { data: existuje } = await supabase
    .from("milniky").select("id").eq("zakazka_id", zakazkaId).eq("typ", d.typ).is("deleted_at", null).maybeSingle();
  if (existuje) return { ok: false, chyba: "Tento typ milníku už u akce je." };

  const { data: m, error } = await supabase
    .from("milniky")
    .insert({ zakazka_id: zakazkaId, typ: d.typ, datum: d.datum, cas: d.cas || null, poznamka: d.poznamka || null })
    .select("id")
    .single();
  if (error || !m) return { ok: false, chyba: "Uložení se nezdařilo." };

  await zapisAudit(supabase, { entita: "milnik", entitaId: m.id, typZmeny: "VYTVORENI", uzivatelId: u.id, nova: { typ: d.typ, datum: d.datum } });
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

  if (d.typ !== m.typ) {
    const { data: kolize } = await supabase
      .from("milniky").select("id")
      .eq("zakazka_id", m.zakazka_id).eq("typ", d.typ).is("deleted_at", null).neq("id", milnikId).maybeSingle();
    if (kolize) return { ok: false, chyba: "Tento typ milníku už u akce je." };
  }

  await supabase.from("milniky")
    .update({ typ: d.typ, datum: d.datum, cas: d.cas || null, poznamka: d.poznamka || null })
    .eq("id", milnikId);
  await zapisAudit(supabase, { entita: "milnik", entitaId: milnikId, typZmeny: "UPRAVA", uzivatelId: u.id, nova: { typ: d.typ, datum: d.datum } });
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

// ---- Přerušení / obnovení akce -------------------------------------------
export async function prerusitAkci(zakazkaId: string, _prev: ZakazkaStav, fd: FormData): Promise<ZakazkaStav> {
  const u = await writer();
  if (!u) return { obecna: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, konec_aktualni, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { obecna: "Akce nenalezena." };

  const datumStr = String(fd.get("datumOd") ?? "");
  const duvod = String(fd.get("duvod") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datumStr)) return { chyby: { datumOd: "Zadejte datum přerušení." } };
  if (duvod.length < 3) return { chyby: { duvod: "Uveďte důvod přerušení." } };

  const { data: otevrene } = await supabase
    .from("preruseni").select("id").eq("zakazka_id", zakazkaId).is("datum_do", null).maybeSingle();
  if (otevrene) return { obecna: "Akce už je přerušená." };

  const datumOd = parseDay(datumStr);
  const zbyvajiciDny = Math.max(
    0,
    Math.round((parseDay(z.konec_aktualni).getTime() - datumOd.getTime()) / 86400000),
  );

  await supabase.from("preruseni").insert({
    zakazka_id: zakazkaId, datum_od: datumStr, zbyvajici_dny: zbyvajiciDny, duvod, prerusil_id: u.id,
  });
  await supabase.from("zakazky").update({ stav: "POZASTAVENO" }).eq("id", zakazkaId);
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
    nova: { preruseno: datumStr, duvod, zbyvajiciDny },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky/plan");
  return {};
}

export async function obnovitAkci(zakazkaId: string, _prev: ZakazkaStav, fd: FormData): Promise<ZakazkaStav> {
  const u = await writer();
  if (!u) return { obecna: "Nejste přihlášeni nebo nemáte právo zápisu." };
  const supabase = await createClient();
  const { data: z } = await supabase
    .from("zakazky").select("id, konec_aktualni, deleted_at").eq("id", zakazkaId).maybeSingle();
  if (!z || z.deleted_at) return { obecna: "Akce nenalezena." };

  const datumStr = String(fd.get("datumObnoveni") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datumStr)) return { chyby: { datumObnoveni: "Zadejte datum obnovení." } };

  const { data: preruseni } = await supabase
    .from("preruseni").select("id, zbyvajici_dny")
    .eq("zakazka_id", zakazkaId).is("datum_do", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!preruseni) return { obecna: "Akce není přerušená." };

  const datumObnoveni = parseDay(datumStr);
  const novyKonec = addDays(datumObnoveni, preruseni.zbyvajici_dny);
  const staryKonec = z.konec_aktualni;

  await supabase.from("preruseni")
    .update({ datum_do: datumStr, obnovil_id: u.id }).eq("id", preruseni.id);
  await supabase.from("zakazky")
    .update({ stav: "AKTIVNI", konec_aktualni: formatDay(novyKonec) }).eq("id", zakazkaId);
  // „celodélková" přiřazení posunout na nový konec
  const { data: celodelkova } = await supabase
    .from("prirazeni_zakazka").select("id")
    .eq("zakazka_id", zakazkaId).is("deleted_at", null).eq("datum_do", staryKonec);
  for (const pr of celodelkova ?? []) {
    await supabase.from("prirazeni_zakazka").update({ datum_do: formatDay(novyKonec) }).eq("id", pr.id);
  }
  await zapisAudit(supabase, {
    entita: "zakazka", entitaId: zakazkaId, typZmeny: "UPRAVA", uzivatelId: u.id,
    nova: { obnoveno: datumStr, novyKonec: formatDay(novyKonec) },
  });
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky/plan");
  return {};
}

// ---- Správa pracovníků u existující akce ---------------------------------
export type PracVysledek = { ok: boolean; chyba?: string; potrebaPotvrzeni?: string };
const DEN_RE = /^\d{4}-\d{2}-\d{2}$/;

async function konfliktPracovnika(
  supabase: Db,
  osobaId: string,
  od: Date,
  doD: Date,
  excludeId?: string,
): Promise<string | null> {
  let q = supabase
    .from("prirazeni_zakazka")
    .select("id, datum_od, datum_do, zakazka:zakazky!inner(kod, deleted_at)")
    .eq("osoba_id", osobaId)
    .is("deleted_at", null)
    .is("zakazka.deleted_at", null)
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

export async function odebratPracovnika(prirazeniId: string, duvod: string): Promise<PracVysledek> {
  const u = await writer();
  if (!u) return { ok: false, chyba: "Nejste přihlášeni nebo nemáte právo zápisu." };
  if (duvod.trim().length < 3) return { ok: false, chyba: "Uveďte důvod." };
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("prirazeni_zakazka")
    .select("id, zakazka_id, datum_od, datum_do, deleted_at, osoba:profiles(name)")
    .eq("id", prirazeniId)
    .maybeSingle();
  if (!p || p.deleted_at) return { ok: false, chyba: "Přiřazení nenalezeno." };
  const jmeno = (p.osoba as unknown as { name: string } | null)?.name ?? "?";

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

  const konflikt = await konfliktPracovnika(supabase, p.osoba_id, odD, doD, p.id);
  const jmeno = (p.osoba as unknown as { name: string } | null)?.name ?? "?";
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
