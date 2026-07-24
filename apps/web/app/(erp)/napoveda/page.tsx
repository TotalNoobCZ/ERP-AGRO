// Vestavěná nápověda / manuál (ikonka „i" v hlavičce). Jediný zdroj pravdy –
// při změnách funkcí aktualizuj tuto stránku i datum níže.
import type { ReactNode } from "react";

const AKTUALIZOVANO = "23. 7. 2026 (Dílna, Fakturace jako finále akce, multi-filtr stavů, kontakty na tabuli, Moje práce)";

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
        Jednotný systém pro <strong>Poptávky · Zakázky · Konstrukci · Dílnu</strong> — jedno přihlášení,
        jedna databáze, společná správa lidí.
      </P>
      <P>
        Po přihlášení tě uvítá <strong>„Moje práce"</strong> — osobní rozcestník: připomínky odložených
        poptávek, tvoje otevřené poptávky, tvoje aktivní zakázky a dlaždice modulů (podle práv).
      </P>

      <H2>1. Přihlášení a heslo</H2>
      <H3>První přihlášení („Jsem tu poprvé")</H3>
      <UL>
        <li>Administrátor tě nejdřív založí ve <strong>Správě</strong> (bez hesla).</li>
        <li>Na přihlašovací stránce klikni na <strong>„Jsem tu poprvé"</strong>.</li>
        <li>Zadej svůj <strong>e-mail</strong> a <strong>nové heslo</strong> (min. 8 znaků) → systém tě přihlásí.</li>
        <li><strong>Po prvním přihlášení</strong> se objeví okénko s nabídkou projít si návod – <em>Ano</em> otevře manuál, <em>Teď ne</em> tě pustí na hlavní obrazovku. Návod pak kdykoli otevřeš přes <Code>ⓘ</Code> v hlavičce.</li>
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
        <li><strong>Hlavní karty</strong> (Poptávky · Zakázky · Konstrukce · Dílna; Správa jen admin) tě pustí na <strong>Přehled</strong> modulu. Které karty vidíš, řídí administrátor v <strong>Přístupových právech</strong>.</li>
        <li><strong>Podnavigace</strong> — záložky uvnitř modulu (Přehled / Gantt / Akce / Tabule / Archiv…).</li>
        <li><strong>Sbalení se pamatuje:</strong> sbalené/rozbalené skupiny (akce, oddělení, zakázky k akci, seznamy) zůstanou i po přechodu na jinou kartu nebo obnovení stránky.</li>
        <li><strong>📌 Přišpendlení záložky</strong> — klikni na špendlík u záložky; ta se stane výchozí a otevře se jako první po kliknutí na kartu modulu. Nastavení je osobní (drží se v prohlížeči).</li>
        <li><strong>Světlý/tmavý režim</strong> — přepínač 🌙/☀️ v hlavičce.</li>
        <li><strong>Načítání</strong> — po kliknutí je hned vidět indikátor „Načítám…".</li>
        <li><strong>Datum</strong> — český formát <Code>DD. MM. RRRR</Code> (např. <Code>15. 7. 2026</Code>), lze i přes kalendík. V kalendáři je <strong>dnešní den zvýrazněný</strong> (obrysem), i když není vybraný.</li>
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
        <li><strong>Šéfkonstruktér</strong> — u profilu z oddělení <strong>Konstrukce</strong> lze zaškrtnout pozici Šéfkonstruktér; smí jako jediný (kromě administrátora) <strong>odebírat konstruktéry ze zakázek</strong>.</li>
        <li><strong>Přístupová práva k modulům</strong> — tlačítko <Code>🔐 Přístupová práva</Code> ve Správě otevře matici <em>oddělení × modul</em> (Poptávky / Zakázky / Konstrukce): zaškrtneš, které moduly dané oddělení vidí. U konkrétního zaměstnance lze v jeho profilu zvolit <strong>Vlastní nastavení</strong>, které přepíše oddělení. <strong>Administrátor vidí vždy vše</strong>; kartu Správa má vždy jen admin. Dokud není nic nastaveno, vidí všichni vše (zpětná kompatibilita).</li>
        <li><strong>Dílna jen přiřazené</strong> — uživatelé z kapitoly Dílna (výroba/montáž/elektro) vidí v <strong>Zakázkách</strong> jen zakázky, ke kterým jsou přiřazeni jako pracovník nebo odpovědná osoba (v seznamu Akce i na Tabuli).</li>
        <li><strong>Heslo uživatele</strong> (v jeho detailu): nastavit konkrétní, nebo vygenerovat náhodné a předat. Bez e-mailu se heslo neřeší.</li>
      </UL>

      <H2>6. Poptávky</H2>
      <P>Záložky: Přehled · Poptávky · Tabule · Odložené · Objednáno · Zákazníci.</P>
      <UL>
        <li><strong>Přehled je defaultně „moje":</strong> počty, termíny i „ke kontaktování" jsou přednastavené na přihlášeného uživatele (jeho poptávky). Přepínačem <strong>Moje / Vše</strong> vpravo nahoře zobrazíš čísla za všechny; prokliky do seznamu si filtr osoby nesou s sebou. <strong>Poslední volbu si prohlížeč pamatuje.</strong></li>
        <li><strong>Nová poptávka:</strong> Předmět, Zákazník a <strong>Kontaktní osoba</strong> jsou povinné (<Code>*</Code>). U existujícího zákazníka se v kontaktech nabízejí jen jeho kontakty.</li>
        <li><strong>Kontakty se ukládají:</strong> nový zákazník se uloží i s kontaktní osobou; u stálého zákazníka se nová kontaktní osoba automaticky přidá mezi jeho kontakty (příště se nabídne v seznamu).</li>
        <li><strong>Odpovědná osoba je nepovinná</strong> — doplníš i později; vybírá se z role Vedoucí nebo oddělení Projekťák / Obchodní manažer.</li>
        <li><strong>Termín přímo ze seznamu:</strong> u každé poptávky lze termín přidat/změnit tužkou <Code>✎</Code> ve sloupci Termín – bez otvírání detailu. Termín = lhůta na vypracování nabídky; jakmile je stav <strong>Odesláno</strong> (a dál), lhůta je splněná a „po termínu" se už nehlásí.</li>
        <li><strong>Tabule (drag &amp; drop):</strong> vlevo odpovědné osoby, vpravo nepřidělené poptávky. Přetáhni poptávku na osobu = přiřadíš (z pravého sloupce zmizí). Mezi osobami přeřadíš. <strong>Přidělená poptávka musí mít termín</strong> – když ho poptávka nemá, tabule si při přetažení vyžádá termín v okně. Na kartě jsou vidět i <strong>kontaktní údaje</strong> (👤 jméno, 📞 telefon, ✉️ e-mail) bez otvírání detailu; telefon a e-mail jsou proklikávací.</li>
        <li><strong>Filtr osob</strong> nabízí jen relevantní lidi (kdo smí být odpovědný, plus kdokoli je už na některé poptávce přiřazen).</li>
        <li><strong>Odložit poptávku:</strong> v detailu vyber stav <strong>Odloženo</strong>. Poptávka se skryje ze seznamu i tabule a v okně zvolíš připomenutí: <em>k datu</em>, <em>za 6 měsíců</em>, nebo <em>nepřipomínat</em>.</li>
        <li><strong>Odložené:</strong> záložka se všemi odloženými poptávkami a datem připomenutí; ty, u kterých už čas nastal, jsou zvýrazněné. Tlačítkem <Code>↩ Obnovit</Code> se poptávka vrátí zpět mezi aktivní.</li>
        <li><strong>Připomenutí:</strong> jakmile nastane datum připomenutí, odpovědné osobě se nahoře v Poptávkách ukáže upozornění „⏰ Nastal čas kontaktovat".</li>
        <li><strong>Objednáno:</strong> poptávky, ze kterých se tvoří zakázky.</li>
        <li>Seznam má filtry a <strong>Export do PDF</strong>.</li>
      </UL>

      <H2>7. Zakázky</H2>
      <P>Záložky: Přehled · Akce · Tabule · Gantt · <strong>Fakturace</strong> · Archiv.</P>
      <UL>
        <li><strong>Vznik:</strong> obvykle z objednané poptávky (zdědí zákazníka; <strong>Název akce se předvyplní názvem poptávky</strong> a jde změnit). Nová akce: Název akce, Místo plnění, Začátek, Konec (povinné <Code>*</Code>), priorita.</li>
        <li><strong>Odpovědná osoba</strong> (nepovinná) — z Kanceláře, Projekťáků nebo role Vedoucí. Platí <strong>za celou akci včetně podzakázek</strong>, proto se u podzakázek už nezadává (dědí ji z hlavní akce). Na Tabuli přetažení odpovědné osoby na podzakázku nastaví osobu rovnou na hlavní akci.</li>
        <li><strong>Pracovníci jsou nepovinní</strong> — přiřadíš i později (na Tabuli).</li>
        <li><strong>Gantt:</strong> „Podle akcí" (posun termínů tažením) a „Podle zaměstnance" s filtrem kapitoly <strong>Dílna / Kancelář / Vše</strong>.</li>
        <li><strong>Tabule (obrácené drag &amp; drop):</strong> vlevo osoby dle kapitol a oddělení (sbalitelné), vpravo zakázky. Přetáhni osobu na zakázku = přiřadíš pracovníka; při kolizi termínů systém upozorní. <strong>Dvojklik na osobu</strong> (vlevo i na dlaždici zakázky) otevře její <strong>kartu zaměstnance</strong> (administrátor ji může upravit, ostatní jen prohlížejí).</li>
        <li><strong>Odpovědné osoby</strong> (projekťák / vedoucí) mají vlevo <strong>vlastní skupinu</strong> a na dlaždici zakázky se zobrazují <strong>zvlášť nad pracovníky</strong>. Přetažením projekťáka/vedoucího na zakázku se zaeviduje jako <strong>odpovědná osoba</strong> (ne pracovník); křížkem u ní ji zrušíš.</li>
        <li><strong>Odebrání konstruktéra ze zakázky</strong> smí provést jen <strong>šéfkonstruktér</strong> nebo <strong>administrátor</strong> (u ostatních je místo křížku zámek 🔒). Běžné pracovníky odebírá kdokoli s právem zápisu. Šéfkonstruktéra nastaví admin ve Správě u profilu z oddělení Konstrukce.</li>
        <li><strong>Lidé na akci:</strong> u akce se všude zobrazují <strong>všichni lidé</strong> (dělníci, elektrikáři, konstruktéři i odpovědná osoba) sečtení přes akci a její zakázky k akci; u každé zakázky k akci vidíš její lidi zvlášť (seznam Akce – rozbalovací, detail i Tabule).</li>
        <li><strong>Detail:</strong> pracovníci, milníky, prodloužení/přerušení, stav, <strong>konstruktéři z podúkolů</strong>, historie, poznámky, Export do PDF. Tlačítka <strong>životního cyklu</strong> (Hotovo / Proplaceno / …) jsou nahoře v hlavičce vedle Exportu.</li>
        <li><strong>Filtr podle stavů = multi-výběr:</strong> klikni jeden stav (zobrazí jen ten) nebo víc stavů (= všechny kromě zbytku). „Po termínu" je samostatný přepínač. Nic vybráno = vše kromě archivu.</li>
        <li><strong>Zakázky k akci:</strong> jedna hlavní akce může sdružovat víc <strong>dceřiných zakázek</strong> (každá má vlastní název). V detailu akce (pod „Přiřazení pracovníci") je rychle přidáš lištou <strong>Název akce + Popis</strong>; místo, termíny a prioritu zdědí od hlavní akce. V seznamu Akce se ukazují jako <strong>rozbalovací seznam</strong> pod hlavní akcí. V <strong>Konstrukci</strong> se zakázka k akci přidá jako <strong>podúkol do projektu hlavní akce</strong>.</li>
        <li><strong>Životní cyklus akce (finále přes fakturaci):</strong> běžící akci na detailu tlačítkem <strong>✓ Hotovo</strong> uzavřeš – nabídne volbu <em>🧾 Poslat do fakturace</em> (bude se fakturovat) nebo <em>✓ Uzavřít bez fakturace</em> (nefakturuje se → rovnou do archivu). Akce ve stavu <strong>Fakturace</strong> se řeší na liště Fakturace; tlačítkem <strong>✓ Označit proplaceno</strong> se posune do <strong>Proplaceno</strong> = hotové (finále). Krok zpět je vždy možný.</li>
        <li><strong>Lišta Fakturace:</strong> dvě sekce — <em>Fakturace – čeká na proplacení</em> a <em>Proplaceno – hotové</em>. U každé akce vidíš zákazníka, termín a odpovědnou osobu a přímo tu ji posuneš dál.</li>
        <li><strong>Archiv:</strong> obsahuje jen <strong>archivované</strong> akce. Akce ve fakturaci a proplacené najdeš na liště <strong>Fakturace</strong>.</li>
      </UL>

      <H2>8. Konstrukce</H2>
      <P>Záložky: Přehled · Plánování · Gantt · Archiv. Zobrazují se lidé z oddělení <strong>Konstrukce</strong>. Na <strong>Přehledu</strong> je sekce <strong>Akce a konstruktéři</strong> – akce se všemi svými konstruktéry a sbalitelný seznam zakázek k akci, u každé její konstruktéři.</P>
      <UL>
        <li><strong>Projekt vzniká automaticky se zakázkou</strong>; v detailu zakázky ho lze rozdělit na víc projektů.</li>
        <li><strong>Zodpovědný za konstrukční projekt</strong> je vždy <strong>konstruktér</strong> (oddělení Konstrukce) – nikoho jiného tam vybrat nejde. Řešitelé úkolů jsou také konstruktéři.</li>
        <li><strong>Plánovací tabule:</strong> vlevo dlaždice členů, vpravo projekty <strong>seskupené pod akci</strong> (sbalitelné; nahoře <strong>Rozbalit vše / Sbalit vše</strong>). Přepínač <strong>Moje / Vše</strong> zobrazí jen tvou dlaždici a projekty, kde jsi zodpovědný nebo máš úkol; <strong>poslední volba se pamatuje</strong>. Přetáhni úkol na člena = přiřadíš řešitele; uvnitř dlaždice řadíš tažením. <strong>Sundat konstruktéra z úkolu</strong> (tažení zpět doprava) a <strong>zrušit zodpovědného konstruktéra</strong> u projektu smí jen <strong>šéfkonstruktér</strong> nebo <strong>administrátor</strong>; přehodit úkol na jiného konstruktéra může kdokoli s právem zápisu.</li>
        <li><strong>Propojení:</strong> přiřazením řešitele k úkolu se <strong>konstruktér propíše k zakázce</strong> a je vidět v jejím detailu.</li>
        <li><strong>Gantt:</strong> termíny úkolů posouváš tažením; zobrazují se absence. Kolize systém vždy nahlásí (uložit lze i tak).</li>
        <li><strong>Absence</strong> se zadávají v dialogu člena (klik na dlaždici).</li>
      </UL>

      <H2>9. Dílna (mistr / koordinátor výroby)</H2>
      <P>Záložky: Zakázky · Tabule · Gantt. Karta míchá možnosti Zakázek a Konstrukce pro koordinaci výroby. Přístup se řídí <strong>právy modulu</strong> (Správa → Přístupová práva) – typicky pro mistra.</P>
      <UL>
        <li><strong>Tabule:</strong> stejné přetahování jako u Zakázek, ale vlevo jsou <strong>jen lidé z dílen</strong> (výroba / montáž / elektro). Přiřazení pracovníka se <strong>propíše do Zakázek</strong> (sdílená data). Přiřazuje se i na <strong>všechny zakázky k akci</strong> (podzakázky).</li>
        <li><strong>Zakázky:</strong> u každé zakázky (i podzakázky) mistr zadává termíny <strong>výrobních fází</strong> od–do: <em>Pálení a příprava, Svařování, Lakovna, Montáž</em>, a <strong>uskladnění</strong> (kde je díl / stroj). Vše se propisuje do detailu zakázky.</li>
        <li><strong>Vlastní termín podzakázky:</strong> podzakázka může mít <strong>jiný začátek i konec</strong> než hlavní akce – nastavíš ho v detailu Dílny (fáze jsou jen dílčí milníky uvnitř). Konec podzakázky se navíc <strong>automaticky přednastaví na nejzazší termín milníků</strong> (dá se ručně přepsat).</li>
        <li><strong>Gantt:</strong> dva režimy — <em>Podle fází</em> a <em>Podle zaměstnance</em>. Hlavní akce ukazuje svůj <strong>pevný termín</strong> (kotva); podzakázky jsou <strong>sbalitelné podřádky</strong> s vlastními termíny (poslední rozbalení se pamatuje). Výrobní fáze jsou barevné pruhy uvnitř. Tlačítka „Zobrazit vše / Skrýt vše".</li>
      </UL>

      <H2>10. Tisk a export do PDF</H2>
      <UL>
        <li>Tlačítko <strong>🖨 Export do PDF</strong> otevře čistou tiskovou verzi; PDF vytvoříš přes tisk prohlížeče (Ctrl/Cmd+P → Uložit jako PDF).</li>
        <li>Export respektuje aktivní filtry.</li>
      </UL>

      <H2>11. Jak to spolu souvisí</H2>
      <P>
        Objednaná <strong>poptávka</strong> → založí <strong>zakázku</strong> (zdědí zákazníka) → se zakázkou vznikne
        <strong> konstrukční projekt</strong>. Konstruktér přiřazený k úkolu projektu se <strong>propíše zpět k zakázce</strong>.
        Výrobu koordinuje <strong>Dílna</strong> (fáze, termíny podzakázek). Po dokončení jde akce do <strong>fakturace</strong> a
        po zaplacení do stavu <strong>Proplaceno</strong> = finále akce (nebo se rovnou uzavře, když se nefakturuje).
      </P>

      <H2>12. Rychlý tahák</H2>
      <UL>
        <li><strong>Přiřadit poptávku:</strong> Poptávky → Tabule → přetáhni na osobu.</li>
        <li><strong>Zakázka z poptávky:</strong> Poptávky → Objednáno → otevřít → vytvořit zakázku.</li>
        <li><strong>Pracovníci na zakázku:</strong> Zakázky → Tabule → přetáhni osoby na zakázku.</li>
        <li><strong>Posun termínu:</strong> Zakázky → Gantt → táhni pruh.</li>
        <li><strong>Uzavřít akci:</strong> detail akce → <Code>✓ Hotovo</Code> → do fakturace / uzavřít bez fakturace. Proplacení: Zakázky → Fakturace → <Code>✓ Proplaceno</Code>.</li>
        <li><strong>Naplánovat konstrukci:</strong> Konstrukce → Plánování → přetáhni úkoly na konstruktéry.</li>
        <li><strong>Oblíbená záložka:</strong> klikni na 📌 u záložky.</li>
      </UL>
    </div>
  );
}
