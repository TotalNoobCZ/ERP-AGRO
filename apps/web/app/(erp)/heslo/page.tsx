// Změna vlastního hesla – dostupná všem přihlášeným uživatelům.
import { ZmenaHesla } from "@/components/sprava/ProfilForm";

export default function HesloPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Změna hesla</h1>
      <ZmenaHesla />
    </div>
  );
}
