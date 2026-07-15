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

## Lokální spuštění

Požadavky: Node.js ≥ 20.9, Supabase projekt (cloud, nebo lokální `supabase start`).

1. **Databáze** – aplikuj migrace a seed (v pořadí):
   ```bash
   for f in packages/db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
   psql "$DATABASE_URL" -f packages/db/seed/0001_first_admin.sql
   ```
2. **Aplikace:**
   ```bash
   cp apps/web/.env.example apps/web/.env.local   # doplň URL + klíče ze Supabase
   npm install
   npm run dev                                     # http://localhost:3000
   ```
3. **První přihlášení:** na /login zvol „Jsem tu poprvé", zadej e-mail
   založeného profilu (seed: `rohac@agrocs.cz`, `harantk@agrocs.cz`)
   a nastav si heslo.

## Stav integrace

- [x] Krok 1 – sjednocené SQL schéma (21 tabulek, cross-module FK) – ověřeno na PG16
- [x] Krok 2 – Supabase Auth + RLS (`admin`/`editor`/`viewer`) – ověřeno testy
- [x] Krok 3 – monorepo skelet (Next.js 16, React 19, Tailwind v4, @supabase/ssr),
      login + „Jsem tu poprvé", sdílená navigace, produkční build prochází
- [ ] Krok 4 – přenos modulů: Konstrukce → Poptávky → Plánování
- [ ] Krok 5 – tok mezi moduly (poptávka „Objednáno" → zakázka → projekty)
- [ ] Krok 6 – migrace ostrých dat (deduplikace lidí podle e-mailu)
