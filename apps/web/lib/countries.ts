// ----------------------------------------------------------------------------
//  Státy + telefonní předvolby a formátování telefonu.
// ----------------------------------------------------------------------------

export const COUNTRIES: { name: string; dial: string }[] = [
  { name: "Česko", dial: "+420" },
  { name: "Slovensko", dial: "+421" },
  { name: "Polsko", dial: "+48" },
  { name: "Německo", dial: "+49" },
  { name: "Rakousko", dial: "+43" },
  { name: "Maďarsko", dial: "+36" },
  { name: "Slovinsko", dial: "+386" },
  { name: "Chorvatsko", dial: "+385" },
  { name: "Rumunsko", dial: "+40" },
  { name: "Bulharsko", dial: "+359" },
  { name: "Itálie", dial: "+39" },
  { name: "Francie", dial: "+33" },
  { name: "Španělsko", dial: "+34" },
  { name: "Nizozemsko", dial: "+31" },
  { name: "Belgie", dial: "+32" },
  { name: "Švédsko", dial: "+46" },
  { name: "Finsko", dial: "+358" },
  { name: "Dánsko", dial: "+45" },
  { name: "Norsko", dial: "+47" },
  { name: "Estonsko", dial: "+372" },
  { name: "Lotyšsko", dial: "+371" },
  { name: "Litva", dial: "+370" },
  { name: "Ukrajina", dial: "+380" },
  { name: "Velká Británie", dial: "+44" },
  { name: "Švýcarsko", dial: "+41" },
  { name: "Jiný", dial: "" },
];

/** Vrátí předvolbu pro daný stát (např. "Česko" → "+420"), nebo "". */
export function dialForCountry(country?: string | null): string {
  if (!country) return "";
  return COUNTRIES.find((c) => c.name === country)?.dial ?? "";
}

/**
 * Naformátuje telefon po skupinách po 3 číslicích pro snadné opsání,
 * např. "+420777123456" → "+420 777 123 456".
 */
export function formatPhone(raw?: string | null): string {
  if (!raw) return "";
  const t = raw.trim();
  const m = t.match(/^(\+\d{1,3})?[\s\-()]*([\d\s\-()]*)$/);
  const dial = m?.[1] ?? "";
  const rest = (m?.[2] ?? "").replace(/[^\d]/g, "");
  const grouped = rest.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  return [dial, grouped].filter(Boolean).join(" ");
}
