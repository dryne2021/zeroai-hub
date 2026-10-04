"use client";

import { useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { formatMoney } from "@/lib/format";

/** Card checkout through Paystack's hosted page. Amounts are in US cents. */
export function PayPanel({
  taskId,
  quoteId,
  amount,
  expertName,
  onClose,
}: {
  taskId: string;
  quoteId: string;
  amount: number;
  expertName: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function payCard() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/payments/paystack/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, quoteId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(body.error || "Could not open the checkout. Try again.");
      return;
    }
    window.location.href = body.url;
  }

  return (
    <div className="rounded-panel border-2 border-ink bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg font-bold">Pay {formatMoney(amount)} into escrow</p>
          <p className="mt-0.5 text-sm text-muted">{expertName} is paid only after you accept the work.</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink" disabled={busy}>
          Cancel
        </button>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        <li className="flex items-start gap-2">
          <CreditCard size={16} className="mt-0.5 shrink-0 text-seal" aria-hidden /> Visa, Mastercard and other major cards, charged in US dollars.
        </li>
        <li className="flex items-start gap-2">
          <Lock size={16} className="mt-0.5 shrink-0 text-seal" aria-hidden /> You enter card details on Paystack&apos;s secure page, then come straight back here.
        </li>
      </ul>
      <Button type="button" variant="seal" className="mt-4 w-full" onClick={payCard} disabled={busy}>
        {busy ? "Opening checkout…" : `Pay ${formatMoney(amount)} by card`}
      </Button>
      {error && (
        <div className="mt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
    </div>
  );
}
