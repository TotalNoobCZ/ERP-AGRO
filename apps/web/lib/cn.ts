/** Jednoduché skládání Tailwind tříd (bez clsx/tailwind-merge). */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
