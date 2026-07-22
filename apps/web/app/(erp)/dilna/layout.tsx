import { guardModul } from "@/lib/pristup";
import { DilnaSubNav } from "@/components/dilna/sub-nav";

/** Layout modulu Dílna – přístup dle práv, podnavigace Zakázky / Tabule / Gantt. */
export default async function DilnaLayout({ children }: { children: React.ReactNode }) {
  await guardModul("dilna");
  return (
    <div>
      <DilnaSubNav />
      {children}
    </div>
  );
}
