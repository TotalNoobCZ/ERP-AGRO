// Vestavěná nápověda / manuál (ikonka „i" v hlavičce). Jediný zdroj pravdy –
// při změnách funkcí aktualizuj tuto stránku i datum níže.
import type { ReactNode } from "react";

const AKTUALIZOVANO = "16. 7. 2026 (podzakázky, archiv dokončených)";

export const dynamic = "force-dynamic";

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 border-b border-line pb-1 text-xl font-bold">{children}</h2>;
}
function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 text-base font-semibold">{children}</h3>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-text">{children}</p>;
}
function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text">{children}</ul>;
}
function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-accent px-1 py-0.5 text-[0.85em]">{children}</code>;
}

export default function NapovedaPage() {
  return (
    <div className="mx-auto max-w-3xl pb-12">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Nápověda / manuál</h1>
        <span className="text-xs text-text-muted">Aktualizováno: {AKTUALIZOVANO}</span>
      </div>
      <P>
        Jednotný systém pro <strong>Poptávky · Zakázky · Konstrukci</strong> — jedno přihlášení,
        jedna databáze, společná správa lidí.
      </P>

      <H2>1. Přihlášení a heslo</H2>
      <H3>První přihlášení („Jsem tu poprvé")</H3>
      <UL>
        <li>Administrátor tě nejdřív založí ve <strong>Správě</strong> (bez hesla).</li>
        <li>Na přihlašovací stránce klikni na <strong>„Jsem tu poprvé"</strong>.</li>
        <li>Zadej svůj <strong>e-mail</strong> a <strong>nové heslo</strong> (min. 8 znaků) → systém tě přihlásí.</li>
      </UL>
      <H3>Běžné přihlášení</H3>
      <UL>
        <li><strong>Zapamatovat přihlášení</strong> zapnuto → zůstaneš přihlášený i po zavření prohlížeče; vypnuto → po zavření se odhlásíš.</li>
      </UL>
      <H3>Změna hesla a odhlášení</H3>
      <UL>
        <li>Vlastní heslo: v hlavičce odkaz <strong>„Heslo"</strong>.</li>
        <li>Odhlášení: v hlavičce <strong>„Odhlásit"</strong>.</li>
      </UL>

      <H2>2. Orientace v aplikaci</H2>
      <UL>
        <li><strong>Vstupní rozcestník</strong> — klikni na název <strong>„ERP Strojírenská divize"</strong> v hlavičce; zobrazí se dlaždice modulů.</li>
        <li><strong>Hlavní karty</strong> (Poptávky · Zakázky · Konstrukce; Správa jen admin) tě pustí na <strong>Přehled</strong> modulu.</li>
        <li><strong>Podnavigace</strong> — záložky uvnitř modulu (Přehled / Plán / Akce / Tabule / Archiv…).</li>
        <li><strong>📌 Přišpendlení záložky</strong> — klikni na špendlík u záložky; ta se stane výchozí a otevře se jako první po kliknutí na kartu modulu. Nastavení je osobní (drží se v prohlížeči).</li>
        <li><strong>Světlý/tmavý režim</strong> — přepínač 🌙/☀️ v hlavičce.</li>
        <li><strong>Načítání</strong> — po kliknutí je hned vidět indikátor „Načítám…".</li>
        <li><strong>Datum</strong> — český formát <Code>DD. MM. RRRR</Code> (např. <Code>15. 7. 2026</Code>), lze i přes kalendík.</li>
      </UL>

      <H2>3. Role a oprávnění</H2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-line bg-accent px-2 py-1 text-left">Role</th>
              <th className="border border-line bg-accent px-2 py-1 text-left">Co smí</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border border-line px-2 py-1 font-semibold">Administrátor</td><td className="border border-line px-2 py-1">Vše + správa uživatelů a hesel.</td></tr>
            <tr><td className="border border-line px-2 py-1 font-semibold">Zapisovat</td><td className="border border-line px-2 py-1">Číst i zapisovat (poptávky, zakázky, konstrukce).</td></tr>
            <tr><td className="border border-line px-2 py-1 font-semibold">Vedoucí</td><td className="border border-line px-2 py-1">Jen čtení, ale může být odpovědnou osobou / vedoucím projektu.</td></tr>
            <tr><td className="border border-line px-2 py-1 font-semibold">Číst</td><td className="border border-line px-2 py-1">Jen prohlížení.</td></tr>
          </tbody>
        </table>
      </div>
      <P>Zápis mají jen role <strong>Zapisovat</strong> a <strong>Administrátor</strong>. Kartu <strong>Správa</strong> vidí jen administrátor.</P>

      <H2>4. Oddělení a kapitoly</H2>
      <UL>
        <li><strong>Dílna:</strong> Výroba, Montáž, Elektro — fyzická výroba, <strong>nepřihlašuje se</strong> (nepotřebuje e-mail).</li>
        <li><strong>Kancelář:</strong> Kancelář, Obchod, Konstrukce, Projekťák, Elektro projektant, Programátor.</li>
        <li><strong>Konstrukce</strong> (oddělení) = konstruktéři v modulu Konstrukce.</li>
        <li><strong>Projekťák</strong> a role <strong>Vedoucí</strong> = možní vedoucí projektu a odpovědné osoby.</li>
      </UL>

      <H2>5. Správa uživatelů (jen administrátor)</H2>
      <UL>
        <li>Nový/úprava: jméno, e-mail, role, oddělení (rozbalovátko dle kapitol), barva, aktivní.</li>
        <li><strong>E-mail je nepovinný pro kapitolu Dílna</strong> (nepřihlašuje se). „Lze přiřazovat" je automaticky u všech.</li>
        <li><strong>Heslo uživatele</strong> (v jeho detailu): nastavit konkrétní, nebo vygenerovat náhodné a předat. Bez e-mailu se heslo neřeší.</li>
      </UL>

      <H2>6. Poptávky</H2>
      <P>Záložky: Přehled · Poptávky · Tabule · Objednáno · Zákazníci.</P>
      <UL>
        <li><strong>Nová poptávka:</strong> Předmět a Zákazník jsou povinné (<Code>*</Code>). U existujícího zákazníka se v kontaktech nabízejí jen jeho kontakty.</li>
        <li><strong>Odpovědná osoba je nepovinná</strong> — doplníš i později; vybírá se z rolí Vedoucí a oddělení Projekťák.</li>
        <li><strong>Tabule (drag &amp; drop):</strong> vlevo odpovědné osoby, vpravo nepřidělené poptávky. Přetáhni poptávku na osobu = přiřadíš (z pravého sloupce zmizí). Mezi osobami přeřadíš.</li>
        <li><strong>Objednáno:</strong> poptávky, ze kterých se tvoří zakázky.</li>
        <li>Seznam má filtry a <strong>Export do PDF</strong>.</li>
      </UL>

      <H2>7. Zakázky</H2>
      <P>Záložky: Přehled · Plán · Akce · Tabule · Archiv.</P>
      <UL>
        <li><strong>Vznik:</strong> obvykle z objednané poptávky (zdědí zákazníka). Nová akce: Název akce, Místo plnění, Začátek, Konec (povinné <Code>*</Code>), priorita.</li>
        <li><strong>Odpovědná osoba</strong> (nepovinná) — z Kanceláře, Projekťáků nebo role Vedoucí.</li>
        <li><strong>Pracovníci jsou nepovinní</strong> — přiřadíš i později (na Tabuli).</li>
        <li><strong>Plán:</strong> „Podle akcí" (posun termínů tažením) a „Podle zaměstnance" s filtrem kapitoly <strong>Dílna / Kancelář / Vše</strong>.</li>
        <li><strong>Tabule (obrácené drag &amp; drop):</strong> vlevo osoby dle kapitol a oddělení (sbalitelné), vpravo zakázky. Přetáhni osobu na zakázku = přiřadíš pracovníka; při kolizi termínů systém upozorní.</li>
        <li><strong>Lidé na akci:</strong> u akce se všude zobrazují <strong>všichni lidé</strong> (dělníci, elektrikáři, konstruktéři i odpovědná osoba) sečtení přes akci a její zakázky k akci; u každé zakázky k akci vidíš její lidi zvlášť (seznam Akce – rozbalovací, detail i Tabule).</li>
        <li><strong>Detail:</strong> pracovníci, milníky, prodloužení/přerušení, stav, <strong>konstruktéři z podúkolů</strong>, historie, poznámky, Export do PDF.</li>
        <li><strong>Zakázky k akci:</strong> jedna hlavní akce může sdružovat víc <strong>dceřiných zakázek</strong> (každá má vlastní název). V detailu akce (pod „Přiřazení pracovníci") je rychle přidáš lištou <strong>Název akce + Popis</strong>; místo, termíny a prioritu zdědí od hlavní akce. V seznamu Akce se ukazují jako <strong>rozbalovací seznam</strong> pod hlavní akcí. V <strong>Konstrukci</strong> se zakázka k akci přidá jako <strong>podúkol do projektu hlavní akce</strong>.</li>
        <li><strong>Archiv:</strong> obsahuje <strong>dokončené</strong> i archivované akce.</li>
      </UL>

      <H2>8. Konstrukce</H2>
      <P>Záložky: Přehled · Plánování · Gantt · Archiv. Zobrazují se lidé z oddělení <strong>Konstrukce</strong>. Na <strong>Přehledu</strong> je sekce <strong>Akce a konstruktéři</strong> – akce se všemi svými konstruktéry a sbalitelný seznam zakázek k akci, u každé její konstruktéři.</P>
      <UL>
        <li><strong>Projekt vzniká automaticky se zakázkou</strong>; v detailu zakázky ho lze rozdělit na víc projektů.</li>
        <li><strong>Zodpovědný za konstrukční projekt</strong> je vždy <strong>konstruktér</strong> (oddělení Konstrukce) – nikoho jiného tam vybrat nejde. Řešitelé úkolů jsou také konstruktéři.</li>
        <li><strong>Plánovací tabule:</strong> vlevo dlaždice členů, vpravo projekty <strong>seskupené pod akci</strong> (sbalitelné). Přetáhni úkol na člena = přiřadíš řešitele; zpět doprava = odebereš; uvnitř dlaždice řadíš tažením.</li>
        <li><strong>Propojení:</strong> přiřazením řešitele k úkolu se <strong>konstruktér propíše k zakázce</strong> a je vidět v jejím detailu.</li>
        <li><strong>Gantt:</strong> termíny úkolů posouváš tažením; zobrazují se absence. Kolize systém vždy nahlásí (uložit lze i tak).</li>
        <li><strong>Absence</strong> se zadávají v dialogu člena (klik na dlaždici).</li>
      </UL>

      <H2>9. Tisk a export do PDF</H2>
      <UL>
        <li>Tlačítko <strong>🖨 Export do PDF</strong> otevře čistou tiskovou verzi; PDF vytvoříš přes tisk prohlížeče (Ctrl/Cmd+P → Uložit jako PDF).</li>
        <li>Export respektuje aktivní filtry.</li>
      </UL>

      <H2>10. Jak to spolu souvisí</H2>
      <P>
        Objednaná <strong>poptávka</strong> → založí <strong>zakázku</strong> (zdědí zákazníka) → se zakázkou vznikne
        <strong> konstrukční projekt</strong>. Konstruktér přiřazený k úkolu projektu se <strong>propíše zpět k zakázce</strong>.
      </P>

      <H2>11. Rychlý tahák</H2>
      <UL>
        <li><strong>Přiřadit poptávku:</strong> Poptávky → Tabule → přetáhni na osobu.</li>
        <li><strong>Zakázka z poptávky:</strong> Poptávky → Objednáno → otevřít → vytvořit zakázku.</li>
        <li><strong>Pracovníci na zakázku:</strong> Zakázky → Tabule → přetáhni osoby na zakázku.</li>
        <li><strong>Posun termínu:</strong> Zakázky → Plán → táhni pruh.</li>
        <li><strong>Naplánovat konstrukci:</strong> Konstrukce → Plánování → přetáhni úkoly na konstruktéry.</li>
        <li><strong>Oblíbená záložka:</strong> klikni na 📌 u záložky.</li>
      </UL>
    </div>
  );
}
