# Sjednocené SQL schéma – rozhodnutí a body k potvrzení

Tento dokument doprovází migrace v `packages/db/migrations/`. Shrnuje, jak se tři
původní datové modely sloučily do jednoho, a vypíchne místa, kde je potřeba tvoje
potvrzení (**[POTVRDIT]**), než se přepisují moduly.

Předlohy:
- **Poptávky** → `Popt-vky/prisma/schema.prisma` (reálný kód)
- **Plánování** → `Planovani/prisma/schema.prisma` (reálný kód)
- **Konstrukce** → `ZADANI.md` (zadání; repo `Konstrukce-` je zatím prázdné)

---

## 1. Sjednocení lidí (`profiles`)

Tři původní modely lidí → jedna tabulka `profiles` napojená na `auth.users`.

| Zdroj | Původní entita | Poznámka k migraci |
|---|---|---|
| Poptávky | `Person` (měl `passwordHash`, `email`) | účet obchodníka → `profiles`, `oddeleni='obchod'` |
| Plánování | `Osoba` + `Uzivatel` | sloučit do 1 profilu; Dílna bez loginu = profil bez `auth_user_id` |
| Konstrukce | `profiles` | přebírá se `color_index`, `has_tile`→`assignable`, `tile_order` |

**Mapování rolí** (dle `ERP_datovy_model.md` kap. 4):

| Zdroj | Původní role | Sjednocené `role` |
|---|---|---|
| Plánování | `ADMIN` | `admin` |
| Plánování | `NADRIZENY` | `editor` |
| Plánování | `NAHLED` | `viewer` |
| Konstrukce | `write` | `editor` |
| Konstrukce | `read` | `viewer` |
| Poptávky | `Person` (účet) | `editor` |

`oddeleni` a `assignable` jsou **nezávislé na roli** (řešitelem může být i `viewer`).

Při migraci dat **deduplikovat lidi podle e‑mailu** (stejný člověk může být ve víc
aplikacích).

---

## 2. Rozhodnuté body (potvrzeno)

### 2.1 Identita profilu: `id` vs `auth_user_id`  ✅ potvrzeno
Místo `profiles.id = auth.users.id` (návrh v modelu) se používá **nezávislé
`profiles.id` + nullable `auth_user_id`**.
Důvod: všechny tři aplikace zakládají účet **před** prvním přihlášením (vedoucí
založí profil bez hesla → člověk si při 1. loginu nastaví heslo). Kdyby `id` bylo
rovno `auth.users.id`, nešel by profil vytvořit dřív, než existuje auth uživatel.
- Vazba přes `auth_user_id` (doplní se při 1. loginu, server-side / service_role).
- **Dopad:** RLS porovnává `auth.uid() = profiles.auth_user_id`.

### 2.2 Role a admini  ✅ potvrzeno
`write`/`Person`/`NADRIZENY` → `editor`; **správu uživatelů má jen `admin`**.
- Adminové: **Jakub Roháč** a **Kryštof Harant**.
- Ostatní uživatelé: `editor` (zápis) nebo `viewer` (jen čtení), zakládají se v UI.

### 2.3 Typy identifikátorů (uuid vs cuid)  ✅ potvrzeno
Sjednoceno na **`uuid`** (`gen_random_uuid()`). Stará `cuid` id z Poptávek/Plánování
se při migraci dat **přemapují** na nová `uuid` (mapa staré→nové id). Migrace dat
je až poslední krok.

### 2.4 Rozdělené jméno v Plánování  ✅ potvrzeno (řešíme později)
`name = "jmeno prijmeni"`; `pozice`, `osobni_cislo`, `poznamka` ponechány jako
volitelné sloupce. `vlastnost` (jen Dílna) a `jeNadrizeny` (nahrazeno rolí) se
**zatím zahazují** – případně se doplní později.

### 2.5 Autor u volných textů (Poptávky)  ✅ potvrzeno
`comments.author` a `status_logs.changed_by` zůstávají **volný text** (kvůli 1:1
migraci historie). Volitelně lze později přidat `author_id → profiles(id)`.

---

## 3. Nová propojení mezi moduly (jádro integrace)

| Nový cizí klíč | Odkud → kam | Význam |
|---|---|---|
| `zakazky.inquiry_id` | zakázka → poptávka | z jaké poptávky zakázka vznikla |
| `zakazky.customer_id` | zakázka → zákazník | zděděný zákazník z poptávky |
| `projects.zakazka_id` **NOT NULL** | projekt → zakázka | konstrukční projekt vždy patří k zakázce |
| všechny odkazy na lidi | `*.<person> → profiles.id` | jeden model lidí |

Tok dat: **Zákazník → Poptávka → (OBJEDNANO) → Zakázka → Projekt → Úkol → řešitel.**

---

## 4. Co je a není v tomto kroku

- ✅ Krok 1: tabulky, indexy, cizí klíče, `updated_at` triggery.
- ✅ Krok 2: **RLS** (`0006_rls.sql`) – `viewer` = SELECT; `editor` = zápis;
  `admin` = vše + správa uživatelů (`profiles`). Ověřeno funkčními testy.
- ⏭️ Krok 3+: monorepo skelet `apps/web`, přenos modulů, `supabase-js` klient.

Seed prvního admina (Jakub Roháč) je v `packages/db/seed/` – spustí se ručně.
