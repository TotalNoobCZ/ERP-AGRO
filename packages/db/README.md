# packages/db

Sjednocené SQL schéma ERP systému (jedna Supabase / PostgreSQL databáze pro
všechny tři moduly: Poptávky, Zakázky, Konstrukce).

## Struktura

```
migrations/
  0001_profiles.sql          # sjednocený model lidí + auth vazba + updated_at trigger
  0002_shared_customers.sql  # zákazníci a kontakty (sdílené)
  0003_poptavky.sql          # modul Poptávky (inquiries, comments, status_logs)
  0004_zakazky.sql           # modul Zakázky/plánování (páteř) + cross-module FK
  0005_konstrukce.sql        # modul Konstrukce (projects, tasks, gantt data, absences)
seed/
  0001_first_admin.sql       # první uživatel (Jakub Roháč) – ručně
DESIGN.md                    # rozhodnutí, mapování rolí a body [POTVRDIT]
```

Migrace jsou číslované a musí se aplikovat **v pořadí** (kvůli cizím klíčům:
profiles → customers → inquiries → zakazky → projects).

## Lokální spuštění (návrh dalšího kroku)

Zatím jde o čisté SQL. V dalším kroku se přidá Supabase CLI, aby šlo:

```bash
supabase start                 # lokální Postgres + Studio v Dockeru
supabase db reset              # aplikuje migrations/ + seed
```

Případně aplikovat ručně přes `psql`:

```bash
for f in migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
psql "$DATABASE_URL" -f seed/0001_first_admin.sql
```

## Stav

- [x] Krok 1 – sjednocené schéma (tabulky, indexy, FK). **K revizi.**
- [ ] Krok 2 – RLS politiky + `enable row level security`.
- [ ] Krok 3 – generované TS typy (`supabase gen types`).
