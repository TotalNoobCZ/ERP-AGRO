import { redirect } from "next/navigation";

/** Kořen → výchozí modul. Middleware nepřihlášené přesměruje na /login. */
export default function Home() {
  redirect("/zakazky");
}
