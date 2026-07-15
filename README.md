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

## Nasazení (později)

Až bude lokálně otestováno: založit cloud Supabase projekt, `supabase db push`
(aplikuje tytéž migrace), na Vercelu nastavit env proměnné z `.env.example`
a nasadit z GitHubu. Detaily doplníme, až na to dojde.

## Stav integrace

- [x] Krok 1 – sjednocené SQL schéma (21 tabulek, cross-module FK) – ověřeno na PG16
- [x] Krok 2 – Supabase Auth + RLS (`admin`/`editor`/`viewer`) – ověřeno testy
- [x] Krok 3 – monorepo skelet (Next.js 16, React 19, Tailwind v4, @supabase/ssr),
      login + „Jsem tu poprvé", sdílená navigace, produkční build prochází
- [ ] Krok 4 – přenos modulů: Konstrukce → Poptávky → Plánování
- [ ] Krok 5 – tok mezi moduly (poptávka „Objednáno" → zakázka → projekty)
- [ ] Krok 6 – migrace ostrých dat (deduplikace lidí podle e-mailu)
