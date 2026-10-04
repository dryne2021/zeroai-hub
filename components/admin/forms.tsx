"use client";

import { useState } from "react";
import { useAction } from "@/components/use-action";
import { Button, Notice } from "@/components/ui";
import { CATEGORY_ICON_NAMES } from "@/components/category-icon";
import { processPayout, resolveDispute, reviewExpert, saveCategory, setBan, toggleCategory, updateSettings } from "@/app/actions/admin";
import { centsToInput, formatMoney } from "@/lib/format";
import type { Category, ExpertStatus, Settings } from "@/lib/types";

export function ExpertReviewButtons({ userId, status }: { userId: string; status: ExpertStatus }) {
  const { run, pending } = useAction();
  const [mode, setMode] = useState<null | "rejected" | "suspended">(null);
  const [note, setNote] = useState("");

  if (mode) {
    return (
      <div className="space-y-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input" placeholder={mode === "rejected" ? "What should they improve before reapplying?" : "Why is this account being suspended?"} />
        <div className="flex gap-2">
          <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => reviewExpert(userId, mode, note), () => setMode(null))}>
            {mode === "rejected" ? "Reject application" : "Suspend expert"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Back</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" && (
        <Button size="sm" variant="seal" disabled={pending} onClick={() => run(() => reviewExpert(userId, "approved", ""))}>
          {status === "suspended" ? "Reinstate" : "Approve"}
        </Button>
      )}
      {status === "pending" && <Button size="sm" variant="secondary" onClick={() => setMode("rejected")}>Reject</Button>}
      {status === "approved" && <Button size="sm" variant="danger" onClick={() => setMode("suspended")}>Suspend</Button>}
    </div>
  );
}

export function ResolveDisputeForm({ disputeId, amount }: { disputeId: string; amount: number }) {
  const { run, pending, error } = useAction();
  const [resolution, setResolution] = useState<"refund" | "partial_refund" | "release">("release");
  const [refund, setRefund] = useState(centsToInput(Math.round(amount / 2)));
  const [note, setNote] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => resolveDispute(disputeId, resolution, refund, note));
      }}
    >
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="label">Decision</legend>
        {(
          [
            ["release", "Release to expert", `Expert is paid ${formatMoney(amount)} minus fee`],
            ["partial_refund", "Partial refund", "Split between both"],
            ["refund", "Full refund", `Client gets ${formatMoney(amount)} back`],
          ] as const
        ).map(([value, title, sub]) => (
          <label key={value} className="flex cursor-pointer gap-2 rounded-control border border-thread p-3 has-[:checked]:border-ink has-[:checked]:bg-ink-faint">
            <input type="radio" name="resolution" value={value} checked={resolution === value} onChange={() => setResolution(value)} className="mt-1 accent-[#14213D]" />
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted">{sub}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {resolution === "partial_refund" && (
        <div className="sm:max-w-xs">
          <label className="label" htmlFor={`refund-${disputeId}`}>Refund to client (USD)</label>
          <input id={`refund-${disputeId}`} inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} className="input num" />
        </div>
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input" placeholder="Explain the decision. Both parties will see this." />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" disabled={pending}>Resolve dispute</Button>
    </form>
  );
}

export function PayoutActions({ payoutId }: { payoutId: string }) {
  const { run, pending } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Transfer reference, or a reason if declining" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="seal" disabled={pending} onClick={() => run(() => processPayout(payoutId, "mark_paid", note))}>Mark as paid</Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => processPayout(payoutId, "reject", note))}>Decline</Button>
      </div>
    </div>
  );
}

export function BanControl({ userId, banned }: { userId: string; banned: boolean }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (banned) {
    return <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setBan(userId, false, ""))}>Unban</Button>;
  }
  if (!open) return <Button size="sm" variant="danger" onClick={() => setOpen(true)}>Ban</Button>;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input value={reason} onChange={(e) => setReason(e.target.value)} className="input h-9 py-1 text-sm" placeholder="Reason" />
      <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => setBan(userId, true, reason), () => setOpen(false))}>Confirm ban</Button>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const { run, pending } = useAction();
  const fields: [keyof Settings, string, string][] = [
    ["task_price", "Price per task (USD)", "What clients pay for every task."],
    ["fee_percent", "Platform fee (%)", "Taken from the expert's side of each order."],
    ["min_withdrawal", "Minimum withdrawal (USD)", "Smallest payout an expert can request."],
    ["auto_accept_days", "Auto-accept after (days)", "Delivered work is accepted if the client doesn't respond."],
    ["revisions_included", "Revisions included", "Per task, set when the task is funded."],
  ];
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => updateSettings(Object.fromEntries(fields.map(([k]) => [k, String(f.get(k))]))));
      }}
    >
      {fields.map(([key, label, hint]) => (
        <div key={key}>
          <label className="label" htmlFor={key}>{label}</label>
          <input
            id={key}
            name={key}
            type="number"
            step={key === "fee_percent" ? "0.5" : key === "min_withdrawal" || key === "task_price" ? "0.01" : "1"}
            defaultValue={key === "min_withdrawal" || key === "task_price" ? centsToInput(settings[key]) : settings[key]}
            className="input num"
          />
          <p className="hint">{hint}</p>
        </div>
      ))}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>Save settings</Button>
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<Category | null>(null);
  return (
    <div className="space-y-5">
      <ul className="divide-y divide-thread rounded-control border border-thread">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className={`font-medium ${c.is_active ? "" : "text-muted line-through"}`}>{c.name}</p>
              <p className="truncate text-sm text-muted">{c.description}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => toggleCategory(c.id, !c.is_active))}>
                {c.is_active ? "Hide" : "Show"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <form
        key={editing?.id ?? "new"}
        className="grid gap-3 rounded-control bg-paper p-4 sm:grid-cols-[1fr_1.4fr_140px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            () => saveCategory({ id: editing?.id, name: String(f.get("name")), description: String(f.get("description")), icon: String(f.get("icon")) }),
            () => setEditing(null),
          );
        }}
      >
        <div>
          <label className="label" htmlFor="cat-name">{editing ? "Edit name" : "New category"}</label>
          <input id="cat-name" name="name" required defaultValue={editing?.name} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="cat-desc">Description</label>
          <input id="cat-desc" name="description" defaultValue={editing?.description ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="cat-icon">Icon</label>
          <select id="cat-icon" name="icon" defaultValue={editing?.icon ?? "briefcase"} className="input">
            {CATEGORY_ICON_NAMES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{editing ? "Save" : "Add"}</Button>
          {editing && <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>}
        </div>
      </form>
    </div>
  );
}
