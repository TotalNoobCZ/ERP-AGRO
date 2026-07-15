# packages/db

TypeScript typy databáze + návrhová dokumentace sjednoceného schématu.

> **SQL migrace a seed žijí v `/supabase`** (kořen repa) – je to standardní
> layout pro Supabase CLI, takže lokální vývoj = `supabase start` +
> `supabase db reset`. Tento balíček drží typy a dokumentaci.

## Struktura

```
src/
  database.types.ts   # TS typy tabulek pro typovaný supabase-js klient
                      # (ručně dle migrací; nahradí se `supabase gen types`)
DESIGN.md             # rozhodnutí, mapování rolí, potvrzené body
../../supabase/
  config.toml         # lokální Supabase stack (Docker)
  migrations/         # 6 migrací: profiles → customers → poptavky → zakazky
                      #            → konstrukce → RLS (aplikovat v pořadí)
  seed.sql            # první admini (Jakub Roháč, Kryštof Harant)
```

## Lokální vývoj

Viz kořenový `README.md` – zkráceně:

```bash
npx supabase start     # rozjede lokální Postgres + Auth + Studio (Docker)
npx supabase db reset  # aplikuje migrace + seed
```

Bez Dockeru lze migrace pustit i ručně na libovolný Postgres:

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
psql "$DATABASE_URL" -f supabase/seed.sql
```

## Stav

- [x] Krok 1 – sjednocené schéma (tabulky, indexy, FK). Ověřeno na PG16.
- [x] Krok 2 – RLS politiky. Ověřeno testy.
- [x] Krok 3 – TS typy databáze (`src/database.types.ts`), monorepo skelet.
- [ ] Po rozjetí Supabase projektu: `supabase gen types typescript` → nahradit ruční typy.
