import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Container, EmptyState, PageHeader } from "@/components/ui";
import { ESCROW_LABEL, formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Orders & receipts" };


export default async function OrdersPage() {
  const user = await requireUser("/client/orders");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, tasks(title)")
    .eq("client_id", user.id)
    .neq("escrow_status", "pending")
    .order("paid_at", { ascending: false });
  const orders = (data ?? []) as (Order & { tasks: { title: string } | null })[];

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader title="Orders & receipts" description="Every payment you've made, with its escrow status and a printable receipt." />
      {orders.length === 0 ? (
        <EmptyState title="No payments yet" body="When you accept a quote and pay, the order and its receipt appear here." />
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-thread">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <Link href={`/tasks/${o.task_id}`} className="block truncate font-semibold hover:underline">
                    {o.tasks?.title ?? "Task"}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">
                    {o.receipt_number}, paid by card on {formatDate(o.paid_at)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge tone={ESCROW_LABEL[o.escrow_status].tone}>{ESCROW_LABEL[o.escrow_status].label}</Badge>
                  <span className="num w-28 text-right font-display font-bold">{formatMoney(o.amount)}</span>
                  <Link href={`/orders/${o.id}/receipt`} className="text-sm font-semibold text-ink underline underline-offset-4">
                    Receipt
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  );
}
