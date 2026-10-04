import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { Container } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}/receipt`);
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*, tasks(title)").eq("id", id).maybeSingle();
  const order = data as (Order & { tasks: { title: string } | null }) | null;
  if (!order || !order.paid_at) notFound();
  const { data: people } = await supabase.from("public_profiles").select("id, full_name").in("id", [order.client_id, order.expert_id]);
  const name = (uid: string) => people?.find((p) => p.id === uid)?.full_name || "Member";
  const isExpert = user.id === order.expert_id;

  const rows: [string, string][] = [
    ["Receipt number", order.receipt_number || "—"],
    ["Date paid", formatDate(order.paid_at, true)],
    ["Payment method", "Card (Paystack)"],
    ["Payment reference", order.provider_reference || "—"],
    ["Task", order.tasks?.title || "—"],
    ["Client", name(order.client_id)],
    ["Expert", name(order.expert_id)],
  ];

  return (
    <Container className="max-w-2xl py-10 print:py-0">
      <div className="panel p-6 sm:p-10 print:border-0">
        <div className="flex items-start justify-between">
          <Logo />
          <p className="text-right text-sm text-muted">Payment receipt</p>
        </div>
        <dl className="mt-8 divide-y divide-thread text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[150px_1fr] gap-4 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 rounded-control bg-paper p-4 text-[15px]">
          <div className="flex justify-between py-1">
            <span>Amount paid</span>
            <span className="num font-semibold">{formatMoney(order.amount)}</span>
          </div>
          {isExpert && (
            <>
              <div className="flex justify-between py-1 text-muted">
                <span>Platform fee ({Number(order.fee_percent)}%)</span>
                <span className="num">−{formatMoney(order.fee_amount)}</span>
              </div>
              <div className="flex justify-between py-1 font-semibold">
                <span>Your earnings</span>
                <span className="num">{formatMoney(order.expert_amount)}</span>
              </div>
            </>
          )}
          {order.refund_amount > 0 && (
            <div className="flex justify-between py-1 text-amber">
              <span>Refunded on {formatDate(order.refunded_at)}</span>
              <span className="num">−{formatMoney(order.refund_amount)}</span>
            </div>
          )}
        </div>
        <p className="mt-6 text-xs text-muted">ZeroAI Hub holds payments in escrow and releases them to the expert when the client accepts the work. Amounts in US dollars.</p>
        <PrintButton />
      </div>
    </Container>
  );
}
