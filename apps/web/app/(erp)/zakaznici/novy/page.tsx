import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CustomerCreateForm } from "@/components/poptavky/customer-forms";

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Nový zákazník</h1>
      <Card>
        <CardHeader><CardTitle>Údaje</CardTitle></CardHeader>
        <CardContent>
          <CustomerCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
