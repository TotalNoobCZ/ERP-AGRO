// Validace modulu Zakázky – převzato 1:1 z Planovani/src/lib/validations.ts
// (jen část Osoba nahrazena validací profilu ve Správě).
import { z } from "zod";

const denRegex = /^\d{4}-\d{2}-\d{2}$/;
const den = z.string().regex(denRegex, "Zadejte datum ve tvaru RRRR-MM-DD");

export const zakazkaSchema = z
  .object({
    kod: z.string().trim().min(1, "Zadejte kód akce"),
    mistoPlneni: z.string().trim().min(1, "Zadejte místo plnění"),
    priorita: z.coerce.number().int().min(1, "Priorita 1–5").max(5, "Priorita 1–5"),
    zacatek: den,
    konec: den,
    poznamka: z.string().trim().optional(),
    odpovednaOsobaId: z.string().optional().or(z.literal("")),
    inquiryId: z.string().optional().or(z.literal("")),
    customerId: z.string().optional().or(z.literal("")),
    prirazeni: z
      .array(
        z.object({
          osobaId: z.string().min(1, "Vyberte osobu"),
          datumOd: den,
          datumDo: den,
        }),
      )
      .min(1, "Přiřaďte alespoň jednu osobu"),
  })
  .refine((d) => d.zacatek <= d.konec, {
    message: "Konec nesmí být před začátkem",
    path: ["konec"],
  })
  .superRefine((d, ctx) => {
    d.prirazeni.forEach((p, i) => {
      if (p.datumOd > p.datumDo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Datum od nesmí být po datu do",
          path: ["prirazeni", i, "datumDo"],
        });
      }
    });
  });

export type ZakazkaInput = z.infer<typeof zakazkaSchema>;

// Úprava akce (bez termínu konce – ten se mění přes prodloužení).
export const zakazkaUpravaSchema = z.object({
  kod: z.string().trim().min(1, "Zadejte kód akce"),
  mistoPlneni: z.string().trim().min(1, "Zadejte místo plnění"),
  priorita: z.coerce.number().int().min(1, "Priorita 1–5").max(5, "Priorita 1–5"),
  zacatek: den,
  poznamka: z.string().trim().optional(),
  odpovednaOsobaId: z.string().optional().or(z.literal("")),
});

export const prodlouzeniSchema = z.object({
  novyKonec: den,
  duvod: z.string().trim().min(3, "Uveďte důvod prodloužení"),
});

export const milnikSchema = z.object({
  typ: z.enum(["ZAHAJENI_VYROBY", "PREDANI_LAKOVANI", "UKONCENI_VYROBY", "UKONCENI_LAKOVANI"]),
  datum: den,
  cas: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Čas ve tvaru HH:MM")
    .optional()
    .or(z.literal("")),
  poznamka: z.string().trim().optional(),
});

// Profil (Správa) – sjednocená náhrada za osobaSchema.
export const profilSchema = z
  .object({
    name: z.string().trim().min(1, "Zadejte jméno"),
    // E-mail je nepovinný – lidé z dílny se nepřihlašují (viz superRefine níže).
    email: z.string().trim().optional().or(z.literal("")),
    role: z.enum(["admin", "editor", "viewer"]),
    oddeleni: z.enum(["obchod", "dilna", "kancelar", "elektro", "konstrukce", "projektak"]).optional().or(z.literal("")),
    assignable: z.boolean(),
    colorIndex: z.coerce.number().int().min(0).max(9).optional(),
    active: z.boolean(),
    pozice: z.string().trim().optional(),
    osobniCislo: z.string().trim().optional(),
    poznamka: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const email = data.email?.trim() ?? "";
    // Dílna se nepřihlašuje → e-mail nemusí mít. Ostatní oddělení ho vyžadují.
    if (data.oddeleni !== "dilna" && email === "") {
      ctx.addIssue({ path: ["email"], code: z.ZodIssueCode.custom, message: "Zadejte e-mail" });
    }
    // Pokud e-mail vyplněný je (i u dílny), musí být platný.
    if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({ path: ["email"], code: z.ZodIssueCode.custom, message: "Neplatný e-mail" });
    }
  });

export type ProfilInput = z.infer<typeof profilSchema>;
