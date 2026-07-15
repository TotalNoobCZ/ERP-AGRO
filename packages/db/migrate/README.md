# Migrace ostrých dat (krok 6)

Přenese reálná data ze tří starých aplikací do sjednocené ERP databáze.
Deduplikuje lidi podle e-mailu, přemapuje staré `cuid`/id na nová `uuid`
a propojí entity. **Idempotentní** – opakované spuštění nevytváří duplicity
(drží se pomocné tabulky `migrace_map` v cílové DB).

## Co je potřeba

Připojení (read-only stačí) k původním Postgres databázím + zápis do nové:

| Proměnná | Zdroj |
|---|---|
| `SRC_POPTAVKY_URL` | Postgres aplikace **Popt-vky** (Prisma – `DATABASE_URL`) |
| `SRC_PLANOVANI_URL` | Postgres aplikace **Planovani** (Prisma – `DATABASE_URL`) |
| `SRC_KONSTRUKCE_URL` | Postgres/Supabase aplikace **Konstrukce** (volitelné) |
| `TARGET_DATABASE_URL` | **nová** Supabase DB – přímé připojení (port 5432, ne pooler) |

> `TARGET_DATABASE_URL` je „Connection string → URI" ze Supabase
> (Settings → Database), s heslem DB. Použij **přímé** připojení (5432),
> ne connection pooler (6543) – migrace jede mimo aplikaci.

Když nemáš přímý přístup k živým DB, obnov si jejich **dump** do dočasného
Postgresu a nasměruj `SRC_*` tam.

## Spuštění

```bash
# 1) Nanečisto – nic nezapíše, ověří připojení a přečte zdroje. Pozn.: v
#    dry-runu se nezapisuje mapa, takže navazující tabulky (contacts,
#    inquiries…) ukáže 0 – slouží hlavně k ověření spojení a schématu:
npm run migrate -- --dry-run

# 2) Ostrá migrace:
npm run migrate

# jen vybrané zdroje:
npm run migrate -- --only=poptavky,planovani
```

(`npm run migrate` = `node packages/db/migrate/migrate.mjs`, viz kořenový `package.json`.)

## Pořadí a pravidla

1. **Lidé** se sjednocují do `profiles` a **dedupují podle e-mailu** napříč
   všemi třemi zdroji. Kdo nemá e-mail (např. Dílna), dostane syntetický
   `migrace-<zdroj>-<id>@local.invalid`, ať se omylem neslije s jiným.
   Role: Plánování ADMIN/NADRIZENY/NAHLED → admin/editor/viewer,
   Konstrukce write/read → editor/viewer, Poptávky Person → editor.
2. **Poptávky:** customers → contacts → inquiries → comments → status_logs.
3. **Plánování:** zakazky → milniky → přiřazení → přerušení/prodloužení →
   poznámky → audit.
4. **Konstrukce:** staré projekty neměly zakázku, ale nový model to vyžaduje
   (`projects.zakazka_id NOT NULL`). Osiřelé projekty se navěsí na jednu
   přechodovou zakázku **`MIGRACE-KONSTRUKCE`** (dá se pak ručně přeřadit).

## Po migraci

- Přihlášení: profily jsou **bez hesla** (auth se nepřenáší). Každý si heslo
  nastaví přes „Jsem tu poprvé" na svůj e-mail. Lidé se synteticky
  vygenerovaným e-mailem se nepřihlásí – nejdřív jim ve Správě doplň reálný
  e-mail.
- Kontrola: `select source, entita, count(*) from migrace_map group by 1,2;`
- Rollback: smazat přenesené = vyčistit cílové tabulky + `migrace_map`
  (dělej jen na čerstvé DB, ne na provozní!).

## Známé chování

- **Sloučený člověk** (stejný e-mail ve víc zdrojích) si nechá `oddeleni` a
  `assignable` z **prvního** zdroje (pořadí: Poptávky → Plánování → Konstrukce).
  Role se povyšuje z účtu (Uzivatel/Konstrukce). Jednotlivosti se dají po
  migraci upravit ve Správě.

## Stav

- [x] Poptávky, Plánování – mapování dle reálných Prisma schémat.
      **Otestováno** na lokálním Postgresu (dedup podle e-mailu, přemapování
      cizích klíčů, idempotence 2 běhů, povýšení role, syntetické e-maily).
- [~] Konstrukce – dle ZADANI.md (sloupce `projects/tasks/...`); před ostrým
      během ověřit proti reálnému schématu (`--dry-run`) a doladit názvy sloupců.
