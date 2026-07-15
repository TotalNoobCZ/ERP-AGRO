# ERP AGRO

Jeden propojený ERP systém vzniklý integrací tří existujících aplikací:

| Modul | Původní aplikace | Obsah |
|---|---|---|
| **Poptávky** | Popt-vky | zákazníci, poptávky, komentáře, historie stavů |
| **Zakázky** | Planovani | výrobní zakázky (páteř), milníky, plánování lidí |
| **Konstrukce** | konstrukce-agro | projekty, úkoly, Gantt, dlaždice, absence |

Tok dat: **Zákazník → Poptávka → (Objednáno) → Zakázka → Projekt → Úkol → řešitel.**
Jedna Postgres databáze (Supabase + RLS), jedno přihlášení (Supabase Auth),
jeden model lidí (`profiles`). Plán integrace: `ERP_datovy_model.md` (podklad).

## Struktura monorepa

```
apps/
  web/            # jedna Next.js 16 aplikace (moduly jako route group (erp))
packages/
  db/             # SQL migrace (Supabase) + TS typy databáze + DESIGN.md
  core/           # doménové typy, stavy, labely, pracovní dny / kolizní logika
  ui/             # barevné tokeny, paleta uživatelů
```

## Lokální spuštění (testujeme lokálně, na Vercel až potom)

Požadavky na počítač:
- **Node.js ≥ 20.9** (https://nodejs.org)
- **Docker Desktop** (https://docker.com) – běží v něm lokální Supabase
  (Postgres + Auth + Studio); nic se neposílá do cloudu

Postup:

1. **Nainstaluj závislosti:**
   ```bash
   npm install
   ```
2. **Rozjeď lokální Supabase** (poprvé stáhne Docker image, chvíli trvá):
   ```bash
   npm run db:start
   ```
   Na konci vypíše `API URL`, `anon key` a `service_role key`.
3. **Nastav prostředí aplikace:**
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```
   a do `.env.local` vlož vypsané hodnoty (URL + oba klíče).
4. **Aplikuj migrace + seed** (vytvoří všechny tabulky, RLS a první adminy):
   ```bash
   npm run db:reset
   ```
5. **Spusť aplikaci:**
   ```bash
   npm run dev        # http://localhost:3000
   ```
6. **První přihlášení:** na /login zvol „Jsem tu poprvé", zadej
   `rohac@agrocs.cz` nebo `harantk@agrocs.cz` a nastav si heslo.

Užitečné: `npm run db:stop` (vypne stack), Supabase Studio běží na
http://127.0.0.1:54323 (prohlížení dat). Databázi kdykoli srovnáš do čistého
stavu přes `npm run db:reset`.

## Nasazení: cloud Supabase + Vercel

### 1. Databáze (Supabase)
1. https://supabase.com → **New project** (název `erp-agro`, region EU,
   silné DB heslo – ulož si ho).
2. V projektu otevři **SQL Editor**, vlož celý obsah souboru
   [`supabase/remote_setup.sql`](supabase/remote_setup.sql) a spusť (**Run**).
   Vytvoří všechny tabulky, RLS politiky a profily adminů.
3. **Project Settings → API** – budeš potřebovat 3 hodnoty:
   `Project URL`, `anon public` klíč, `service_role` klíč (ten nikdy do frontendu).

### 2. Aplikace (Vercel)
1. https://vercel.com → **Add New… → Project** → importuj GitHub repo
   `TotalNoobCZ/ERP-AGRO`.
2. **Root Directory:** nastav `apps/web` (Edit vedle pole Root Directory).
   Framework: Next.js (auto). Build/install příkazy nech výchozí.
3. **Environment Variables** – přidej (názvy viz `apps/web/.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public klíč
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role klíč
4. **Deploy.** Po nasazení: `/login` → „Jsem tu poprvé" →
   `rohac@agrocs.cz` / `harantk@agrocs.cz` → nastavit heslo.

Každý další push do produkční větve se nasadí automaticky.

## Stav integrace

- [x] Krok 1 – sjednocené SQL schéma (21 tabulek, cross-module FK) – ověřeno na PG16
- [x] Krok 2 – Supabase Auth + RLS (`admin`/`editor`/`viewer`) – ověřeno testy
- [x] Krok 3 – monorepo skelet (Next.js 16, React 19, Tailwind v4, @supabase/ssr),
      login + „Jsem tu poprvé", sdílená navigace, produkční build prochází
- [ ] Krok 4 – přenos modulů:
  - [x] **Poptávky** – dashboard, seznam s filtry, detail (stavy, komentáře,
        historie, „Kontaktovat"), nová/editace, zákazníci + kontakty, tiskové
        exporty. Data přes supabase-js + server actions, autor = přihlášený profil.
  - [x] **Zakázky/Plánování** – seznam akcí s filtry, detail (milníky, poznámky,
        prodloužení, přerušení/obnovení, pracovníci, audit), nová akce s kontrolou
        kolizí a náhradníky, plán (timeline podle akcí i zaměstnanců), archiv
  - [x] **Správa** – zakládání a úprava profilů (role, oddělení, přiřaditelnost,
        barva), změna vlastního hesla
  - [x] **Konstrukce** (postaveno dle ZADANI.md) – Plánování (dlaždice členů
        1/3 + masonry projektů 2/3, drag & drop úkolů přes dnd-kit), dialogy
        úkolu (Začátek/Konec/Trvání s dopočtem, poznámky, todos) a projektu
        (Zodpovídá, Vyčistit, Archivovat), Gantt (tažení a roztahování žížal,
        absence na ose, kolizní hlášení), dialog člena (osobní Gantt + absence),
        Archiv (obnovit, smazat archiv)
- [x] Krok 5 – tok mezi moduly: poptávka „Objednáno" → zakázka (nabídka,
      předvyplnění, dědění zákazníka, zpětné odkazy) a zakázka → konstrukční
      projekty (`projects.zakazka_id` NOT NULL, zakládání z detailu zakázky
      i z boardu s povinným výběrem zakázky)
- Navíc: drag & drop posun/roztažení termínů akcí v plánu Zakázek
  (s povinným důvodem a zápisem do historie)
- [ ] Krok 6 – migrace ostrých dat (deduplikace lidí podle e-mailu)
