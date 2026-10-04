import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { PayoutActions } from "@/components/admin/forms";
import { displayName, formatDate, formatMoney } from "@/lib/format";
import { PAYOUT_METHOD_LABEL, type Payout } from "@/lib/types";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data }, { data: balances }] = await Promise.all([
    db.from("payouts").select("*, users(full_name, email)").order("created_at", { ascending: false }).limit(150),
    db.from("expert_earnings").select("*"),
  ]);
  const rows = (data ?? []) as (Payout & { users: { full_name: string | null; email: string | null } | null })[];
  const queue = rows.filter((p) => p.status === "requested" || p.status === "processing");
  const history = rows.filter((p) => p.status === "paid" || p.status === "rejected");
  const balance = (id: string) => {
    const b = balances?.find((x) => x.expert_id === id);
    return b ? b.earned - b.paid_out : 0;
  };

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Send each withdrawal from your bank, Wise or Payoneer account, then mark it as paid with the transfer reference. The expert is notified with that reference."
      />
      {queue.length === 0 ? (
        <EmptyState title="No withdrawals waiting" />
      ) : (
        <div className="space-y-3">
          {queue.map((p) => (
            <article key={p.id} className="panel grid gap-4 p-5 md:grid-cols-[1fr_360px]">
              <div>
                <p className="num font-display text-xl font-bold">{formatMoney(p.amount)}</p>
                <p className="mt-1 text-[15px] font-medium">
                  {displayName(p.users?.full_name)} <span className="font-normal text-muted">{p.users?.email}</span>
                </p>
                <p className="text-sm text-muted">
                  {PAYOUT_METHOD_LABEL[p.method]}: <span className="break-all text-ink">{p.destination}</span>
                </p>
                <p className="text-sm text-muted">
                  Requested {formatDate(p.created_at, true)}. Balance before this payout: {formatMoney(balance(p.expert_id))}.
                </p>
              </div>
              <PayoutActions payoutId={p.id} />
            </article>
          ))}
        </div>
      )}
      <Panel className="mt-8">
        <PanelHeader title="History" />
        {history.length ? (
          <ul className="divide-y divide-thread">
            {history.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {displayName(p.users?.full_name)}, {PAYOUT_METHOD_LABEL[p.method]}
                  </p>
                  <p className="truncate text-muted">
                    {formatDate(p.processed_at, true)}
                    {p.admin_note ? `. ${p.admin_note}` : ""}
                  </p>
                </div>
                <span className="flex items-center gap-3">
                  <span className="num font-semibold">{formatMoney(p.amount)}</span>
                  <Badge tone={p.status === "paid" ? "seal" : "danger"}>{p.status === "paid" ? "Paid" : "Declined"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">No processed payouts yet.</p>
        )}
      </Panel>
    </>
  );
}
