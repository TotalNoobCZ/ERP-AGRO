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

## 2. Body k potvrzení [POTVRDIT]

### 2.1 Identita profilu: `id` vs `auth_user_id`  ⭐ nejdůležitější
`ERP_datovy_model.md` navrhoval `profiles.id = auth.users.id`. **Zvolil jsem ale
nezávislé `profiles.id` + nullable `auth_user_id`.**
Důvod: všechny tři aplikace zakládají účet **před** prvním přihlášením (vedoucí
založí profil bez hesla → člověk si při 1. loginu nastaví heslo). Kdyby `id` bylo
rovno `auth.users.id`, nešel by profil vytvořit dřív, než existuje auth uživatel.
- **Návrh:** ponechat nezávislé `id`, vazba přes `auth_user_id` (doplní se při 1. loginu).
- **Dopad:** RLS politiky porovnávají `auth.uid() = profiles.auth_user_id`.

### 2.2 Kdo je `admin`?
Sjednocený model má `admin` (správa uživatelů), který Konstrukce ani Poptávky
původně neznaly (tam měl „plný přístup" i běžný zapisovatel).
- **Návrh:** `write`/`Person`/`NADRIZENY` → `editor`; správa uživatelů jen `admin`.
  Vedoucí týmů, kteří dnes spravují uživatele (např. konstrukční vedoucí
  **Jakub Roháč**), dostanou `admin`.
- Alternativa: nechat správu uživatelů i pro `editor` (blíž původní Konstrukci).

### 2.3 Typy identifikátorů (uuid vs cuid)
Poptávky i Plánování používaly `cuid` (text). Nové schéma sjednocuje na **`uuid`**
(`gen_random_uuid()`), což je pro Supabase idiomatické.
- **Dopad na migraci dat:** stará `cuid` id se při importu **přemapují** na nová
  `uuid` (mapa staré→nové id), FK se dopočtou. Migrace dat je až poslední krok.
- Alternativa: ponechat text id a kopírovat 1:1 (jednodušší import, méně čisté).

### 2.4 Rozdělené jméno v Plánování
`Osoba` mělo `jmeno` + `prijmeni` (+ `pozice`, `vlastnost`, `osobniCislo`,
`jeNadrizeny`). `profiles` má jedno `name`.
- **Návrh:** `name = "jmeno prijmeni"`; `pozice`, `osobni_cislo`, `poznamka`
  ponechány jako volitelné sloupce; `vlastnost` (jen Dílna) a `jeNadrizeny`
  (nahrazeno rolí) se **zahazují**. Potvrdit, že o `vlastnost` nikdo nestojí.

### 2.5 Autor u volných textů (Poptávky)
`Comment.author` a `StatusLog.changedBy` byly **volný text** (Poptávky neměly
účty). Ponechávám je jako text kvůli 1:1 migraci; volitelně lze později přidat
`author_id → profiles(id)`.

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
- ⏭️ Krok 2 (další): **RLS politiky** podle rolí (`viewer` = SELECT + vlastní heslo;
  `editor` = zápis; `admin` = vše + správa uživatelů) + `enable row level security`.
- ⏭️ Krok 3+: monorepo skelet `apps/web`, přenos modulů, `supabase-js` klient.

Seed prvního admina (Jakub Roháč) je v `packages/db/seed/` – spustí se ručně.
