// Nová poptávka – načte číselníky a předá je formuláři.
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryPersons, queryResponsibles } from "@/lib/poptavky-query";
import { InquiryForm } from "@/components/poptavky/inquiry-form";

export const dynamic = "force-dynamic";

export default async function NewInquiryPage() {
  const supabase = await createClient();
  const [customersRes, persons, authors, profile] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, contacts(id, name, phone, email)")
      .order("name", { ascending: true }),
    queryResponsibles(supabase),
    queryPersons(supabase),
    getCurrentProfile(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Nová poptávka</h1>
      <InquiryForm
        customers={customersRes.data ?? []}
        persons={persons}
        authors={authors}
        defaultAuthor={profile?.name ?? ""}
      />
    </div>
  );
}
