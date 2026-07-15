// Editace poptávky – načte data a předvyplní formulář.
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryPersons } from "@/lib/poptavky-query";
import { InquiryForm } from "@/components/poptavky/inquiry-form";

export const dynamic = "force-dynamic";

export default async function EditInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [inquiryRes, customersRes, persons, profile] = await Promise.all([
    supabase.from("inquiries").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("customers")
      .select("id, name, contacts(id, name, phone, email)")
      .order("name", { ascending: true }),
    queryPersons(supabase),
    getCurrentProfile(),
  ]);

  const inquiry = inquiryRes.data;
  if (!inquiry) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Upravit poptávku</h1>
      <InquiryForm
        customers={customersRes.data ?? []}
        persons={persons}
        defaultAuthor={profile?.name ?? ""}
        initial={{
          id: inquiry.id,
          subject: inquiry.subject,
          description: inquiry.description,
          source: inquiry.source,
          contactName: inquiry.contact_name,
          contactPhone: inquiry.contact_phone,
          contactEmail: inquiry.contact_email,
          customerId: inquiry.customer_id,
          personId: inquiry.person_id,
          deadline: inquiry.deadline ? inquiry.deadline.slice(0, 10) : "",
          receivedAt: inquiry.received_at.slice(0, 10),
        }}
      />
    </div>
  );
}
