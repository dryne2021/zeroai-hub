"use client";

import { useState } from "react";
import { useAction } from "@/components/use-action";
import { Button, Notice } from "@/components/ui";
import { requestPayout, savePayoutDetails } from "@/app/actions/payouts";
import { centsToInput, formatMoney } from "@/lib/format";
import { PAYOUT_METHOD_LABEL, type PayoutMethod } from "@/lib/types";

export function WithdrawForm({ available, minimum, configured }: { available: number; minimum: number; configured: PayoutMethod[] }) {
  const { run, pending, error } = useAction();
  const [method, setMethod] = useState<PayoutMethod>(configured[0] ?? "bank");
  const [amount, setAmount] = useState(centsToInput(Math.max(0, available)));
  const canWithdraw = available >= minimum && configured.length > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => requestPayout({ amount, method }));
      }}
    >
      {available < minimum && <Notice tone="info">You can withdraw once your available balance reaches {formatMoney(minimum)}.</Notice>}
      {available >= minimum && configured.length === 0 && <Notice tone="amber">Add payout details first, then come back to withdraw.</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="amount">Amount (USD)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="input num pl-7" disabled={!canWithdraw} />
          </div>
          <p className="hint">Minimum {formatMoney(minimum)}.</p>
        </div>
        <div>
          <label className="label" htmlFor="method">Send to</label>
          <select id="method" className="input" value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)} disabled={!canWithdraw}>
            {(["bank", "wise", "payoneer"] as PayoutMethod[]).map((m) => (
              <option key={m} value={m} disabled={!configured.includes(m)}>
                {PAYOUT_METHOD_LABEL[m]}
                {configured.includes(m) ? "" : " (add details)"}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" variant="seal" disabled={!canWithdraw || pending}>
        {pending ? "Requesting…" : "Request withdrawal"}
      </Button>
    </form>
  );
}

type Details = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_swift: string;
  bank_country: string;
  wise_email: string;
  payoneer_email: string;
  mpesa_phone: string;
};

export function PayoutDetailsForm(props: Details) {
  const { run, pending } = useAction();
  const field = (name: keyof Details, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={props[name]} className="input" {...extra} />
    </div>
  );
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const get = (k: keyof Details) => String(f.get(k) || "");
        run(() =>
          savePayoutDetails({
            bank_name: get("bank_name"),
            bank_account_name: get("bank_account_name"),
            bank_account_number: get("bank_account_number"),
            bank_swift: get("bank_swift"),
            bank_country: get("bank_country"),
            wise_email: get("wise_email"),
            payoneer_email: get("payoneer_email"),
            mpesa_phone: get("mpesa_phone"),
          }),
        );
      }}
    >
      <p className="text-sm text-muted">Fill in any of the options below. You choose which one to use each time you withdraw.</p>
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Bank transfer (ACH or wire)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("bank_name", "Bank name")}
          {field("bank_country", "Bank country")}
          {field("bank_account_name", "Account holder name")}
          {field("bank_account_number", "Account number or IBAN", { className: "input num" })}
          {field("bank_swift", "Routing number, SWIFT or BIC", { className: "input uppercase" })}
        </div>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Wallets</legend>
        {field("wise_email", "Wise email", { type: "email" })}
        {field("payoneer_email", "Payoneer email", { type: "email" })}
      </fieldset>
      <Button type="submit" variant="secondary" disabled={pending}>Save payout details</Button>
    </form>
  );
}
