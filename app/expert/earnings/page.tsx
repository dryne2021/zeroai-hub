import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedExpert } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { Badge, Container, PageHeader, Panel, PanelHeader, Stat } from "@/components/ui";
import { PayoutDetailsForm, WithdrawForm } from "@/components/earnings-forms";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYOUT_METHOD_LABEL, type Order, type Payout } from "@/lib/types";
import { configuredPayoutMethods } from "@/lib/payouts";

export const metadata: Metadata = { title: "Earnings" };

const PAYOUT_TONE = { requested: "info", processing: "amber", paid: "seal", rejected: "danger" } as const;

export default async function EarningsPage() {
  const { user, profile } = await requireOnboardedExpert("/expert/earnings");
  const supabase = await createClient();
  const [{ data: e }, { data: payouts }, { data: orders }, settings] = await Promise.all([
    supabase.from("expert_earnings").select("*").eq("expert_id", user.id).maybeSingle(),
    supabase.from("payouts").select("*").eq("expert_id", user.id).order("created_at", { ascending: false }),
    supabase.from("orders").select("*, tasks(title)").eq("expert_id", user.id).in("escrow_status", ["held", "released", "refunded"]).order("paid_at", { ascending: false }).limit(50),
    getSettings(),
  ]);
  const earned = e?.earned ?? 0;
  const available = earned - (e?.paid_out ?? 0) - (e?.pending_payouts ?? 0);
  const configured = profile ? configuredPayoutMethods(profile) : [];

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader title="Earnings" description={`You keep ${100 - settings.fee_percent}% of every order. Earnings become available when the client accepts.`} />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Available" value={formatMoney(available)} />
        <Stat label="In escrow" value={formatMoney(e?.in_escrow ?? 0)} />
        <Stat label="Withdrawals pending" value={formatMoney(e?.pending_payouts ?? 0)} />
        <Stat label="Paid out to date" value={formatMoney(e?.paid_out ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel>
          <PanelHeader title="Withdraw" description="Withdrawals are reviewed and sent within 2 working days." />
          <div className="px-5 py-5">
            {profile?.status === "approved" ? (
              <WithdrawForm key={available} available={available} minimum={settings.min_withdrawal} configured={configured} />
            ) : (
              <p className="text-sm text-muted">Withdrawals are available to active experts. Contact support about any remaining balance.</p>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Payout details" />
          <div className="px-5 py-5">
            <PayoutDetailsForm
              bank_name={profile?.bank_name ?? ""}
              bank_account_name={profile?.bank_account_name ?? ""}
              bank_account_number={profile?.bank_account_number ?? ""}
              bank_swift={profile?.bank_swift ?? ""}
              bank_country={profile?.bank_country ?? ""}
              wise_email={profile?.wise_email ?? ""}
              payoneer_email={profile?.payoneer_email ?? ""}
              mpesa_phone={profile?.mpesa_phone ?? ""}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Withdrawal history" />
          {payouts?.length ? (
            <ul className="divide-y divide-thread">
              {(payouts as Payout[]).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="num font-semibold">{formatMoney(p.amount)}</p>
                    <p className="text-muted">{PAYOUT_METHOD_LABEL[p.method]}, {formatDate(p.created_at)}{p.admin_note ? `. ${p.admin_note}` : ""}</p>
                  </div>
                  <Badge tone={PAYOUT_TONE[p.status]}>{p.status[0].toUpperCase() + p.status.slice(1)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">No withdrawals yet.</p>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Orders" />
          {orders?.length ? (
            <ul className="divide-y divide-thread">
              {(orders as (Order & { tasks: { title: string } | null })[]).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/tasks/${o.task_id}`} className="block truncate font-medium hover:underline">{o.tasks?.title}</Link>
                    <p className="text-muted">
                      {o.escrow_status === "released" ? `Released ${formatDate(o.released_at)}` : o.escrow_status === "held" ? "In escrow" : "Refunded to client"}
                    </p>
                  </div>
                  <span className={`num shrink-0 font-semibold ${o.escrow_status === "refunded" ? "text-muted line-through" : ""}`}>{formatMoney(o.expert_amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">Paid orders appear here.</p>
          )}
        </Panel>
      </div>
    </Container>
  );
}
