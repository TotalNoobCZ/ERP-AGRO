"use client";
// Tlačítko pro vrácení odložené poptávky zpět do hry (→ V jednání).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { obnovitPoptavku } from "@/app/(erp)/poptavky/actions";

export function ObnovitButton({ inquiryId, author }: { inquiryId: string; author: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function obnovit() {
    setLoading(true);
    setError("");
    const res = await obnovitPoptavku(inquiryId, author);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={obnovit}
        disabled={loading}
        data-tip="Vrátit poptávku zpět mezi aktivní"
      >
        {loading ? "Obnovuji…" : "↩ Obnovit"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
