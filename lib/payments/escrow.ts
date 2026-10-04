import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/format";
import { refundTransaction } from "@/lib/payments/paystack";
import type { Order, Quote, Task } from "@/lib/types";

/**
 * Payments service. Escrow moves through: pending -> held -> released | refunded.
 * All amounts are integer US cents. Card payments are taken by Paystack.
 * Every transition is a conditional update, so callbacks that arrive twice are harmless.
 */

export function splitAmount(amount: number, feePercent: number) {
  const fee = Math.round((amount * feePercent) / 100);
  return { fee_amount: fee, expert_amount: amount - fee };
}

function receiptNumber() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `ZAH-${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function logPaymentEvent(orderId: string | null, provider: string, eventType: string, payload: unknown) {
  const admin = createAdminClient();
  await admin.from("payment_events").insert({ order_id: orderId, provider, event_type: eventType, payload: payload as object });
}

/** Creates (or re-points) the pending order for the quote the client chose. */
export async function prepareOrder(taskId: string, quoteId: string, clientId: string): Promise<Order> {
  const admin = createAdminClient();
  const [{ data: task }, { data: quote }] = await Promise.all([
    admin.from("tasks").select("*").eq("id", taskId).single(),
    admin.from("quotes").select("*").eq("id", quoteId).single(),
  ]);
  const t = task as Task | null;
  const q = quote as Quote | null;
  if (!t || t.client_id !== clientId) throw new Error("Task not found");
  if (!q || q.task_id !== taskId || q.status !== "pending") throw new Error("This quote is no longer available");
  if (!["open", "quoted"].includes(t.status)) throw new Error("This task has already been funded");

  const { data: existing } = await admin.from("orders").select("*").eq("task_id", taskId).maybeSingle();
  if (existing && existing.escrow_status !== "pending") throw new Error("This task has already been paid for");

  const settings = await getSettings();
  const split = splitAmount(q.price, settings.fee_percent);
  const row = {
    task_id: taskId,
    quote_id: q.id,
    client_id: clientId,
    expert_id: q.expert_id,
    amount: q.price,
    fee_percent: settings.fee_percent,
    ...split,
    escrow_status: "pending" as const,
    payment_status: "unpaid" as const,
    currency: "USD",
    provider_reference: null,
  };
  const { data, error } = existing
    ? await admin.from("orders").update(row).eq("id", existing.id).eq("escrow_status", "pending").select().single()
    : await admin.from("orders").insert(row).select().single();
  if (error || !data) throw new Error(error?.message || "Could not create order");
  return data as Order;
}

/** Payment confirmed by the provider: money is now held in escrow and the expert is hired. */
export async function markHeld(
  orderId: string,
  info: { method: "card"; reference: string; amountPaid: number; currency: string },
) {
  const admin = createAdminClient();
  const { data: current } = await admin.from("orders").select("*").eq("id", orderId).single();
  const order = current as Order | null;
  if (!order) return { ok: false as const, reason: "order not found" };
  if (order.escrow_status !== "pending") return { ok: true as const, already: true };
  if (info.currency !== order.currency || info.amountPaid < order.amount) {
    await logPaymentEvent(orderId, info.method, "amount_mismatch", info);
    return { ok: false as const, reason: "amount mismatch" };
  }

  const { data: updated } = await admin
    .from("orders")
    .update({
      escrow_status: "held",
      payment_status: "success",
      payment_method: info.method,
      provider_reference: info.reference,
      receipt_number: receiptNumber(),
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("escrow_status", "pending")
    .select()
    .maybeSingle();
  if (!updated) return { ok: true as const, already: true };

  const settings = await getSettings();
  await admin.from("quotes").update({ status: "accepted" }).eq("id", order.quote_id);
  const { data: declined } = await admin
    .from("quotes")
    .update({ status: "declined" })
    .eq("task_id", order.task_id)
    .neq("id", order.quote_id)
    .eq("status", "pending")
    .select("expert_id");
  const { data: task } = await admin
    .from("tasks")
    .update({
      status: "funded",
      expert_id: order.expert_id,
      accepted_quote_id: order.quote_id,
      funded_at: new Date().toISOString(),
      revisions_included: settings.revisions_included,
    })
    .eq("id", order.task_id)
    .select("title")
    .single();

  const link = `/tasks/${order.task_id}`;
  await Promise.all([
    notify({
      userId: order.client_id,
      type: "payment_received",
      title: `Payment received: ${formatMoney(order.amount)}`,
      body: `Your payment for "${task?.title}" is held safely in escrow until you accept the work.`,
      link,
    }),
    notify({
      userId: order.expert_id,
      type: "payment_received",
      title: `You're hired: "${task?.title}"`,
      body: `The client paid ${formatMoney(order.amount)} into escrow. Upload a draft to get started.`,
      link,
    }),
    ...(declined ?? []).map((q) =>
      notify({
        userId: q.expert_id,
        type: "new_quote",
        title: `Another expert was chosen for "${task?.title}"`,
        link,
        email: false,
      }),
    ),
  ]);
  return { ok: true as const };
}

export async function markPaymentFailed(orderId: string, reason: string) {
  const admin = createAdminClient();
  await admin.from("orders").update({ payment_status: "failed" }).eq("id", orderId).eq("escrow_status", "pending");
  await logPaymentEvent(orderId, "system", "payment_failed", { reason });
}

/** Client accepted (or auto-accept fired): unlock the final file and credit the expert. */
export async function releaseEscrow(taskId: string, opts: { auto?: boolean } = {}) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .update({ escrow_status: "released", released_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("escrow_status", "held")
    .select()
    .maybeSingle();
  if (!order) return { ok: false as const, reason: "Nothing held in escrow for this task" };
  const o = order as Order;
  const { data: task } = await admin
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString(), auto_accepted: Boolean(opts.auto) })
    .eq("id", taskId)
    .select("title")
    .single();
  const link = `/tasks/${taskId}`;
  await Promise.all([
    notify({
      userId: o.expert_id,
      type: "task_completed",
      title: `${formatMoney(o.expert_amount)} added to your earnings`,
      body: `"${task?.title}" was ${opts.auto ? "auto-accepted" : "accepted by the client"}. You can now leave a rating.`,
      link,
    }),
    notify({
      userId: o.client_id,
      type: "task_completed",
      title: opts.auto ? `"${task?.title}" was auto-accepted` : `"${task?.title}" is complete`,
      body: "Your final file is unlocked and ready to download.",
      link,
    }),
  ]);
  return { ok: true as const };
}

/** Sends money back to the client's card through Paystack. Returns how the refund was handled. */
async function issueProviderRefund(order: Order, amount: number) {
  try {
    if (order.payment_method === "card" && order.provider_reference) {
      const r = await refundTransaction(order.provider_reference, amount);
      await logPaymentEvent(order.id, "paystack", "refund_sent", r);
      return "sent" as const;
    }
  } catch (err) {
    await logPaymentEvent(order.id, order.payment_method || "unknown", "refund_error", { message: String(err) });
  }
  await logPaymentEvent(order.id, order.payment_method || "unknown", "refund_manual_required", { amount });
  return "manual" as const;
}

/**
 * Full or partial refund decided by an admin.
 * Full: escrow -> refunded, task cancelled. Partial: the rest is released to the expert minus the fee.
 * Works on held escrow, and on released escrow for "AI use confirmed" clawbacks.
 */
export async function refundEscrow(taskId: string, opts: { amount?: number; reason: string }) {
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("*").eq("task_id", taskId).maybeSingle();
  const order = data as Order | null;
  if (!order || !["held", "released"].includes(order.escrow_status)) {
    return { ok: false as const, reason: "No paid order for this task" };
  }
  const full = !opts.amount || opts.amount >= order.amount;
  // A full refund returns whatever hasn't already been refunded (e.g. after an earlier partial refund).
  const refund = full ? order.amount - order.refund_amount : Math.max(1, Math.round(opts.amount!));
  if (refund <= 0) return { ok: false as const, reason: "This order has already been fully refunded" };
  const now = new Date().toISOString();

  if (full) {
    const { data: updated } = await admin
      .from("orders")
      .update({ escrow_status: "refunded", refund_amount: order.amount, refunded_at: now })
      .eq("id", order.id)
      .in("escrow_status", ["held", "released"])
      .select()
      .maybeSingle();
    if (!updated) return { ok: false as const, reason: "Order changed, try again" };
    await admin.from("tasks").update({ status: "cancelled" }).eq("id", taskId);
  } else {
    if (order.escrow_status !== "held") return { ok: false as const, reason: "Partial refunds need funds still in escrow" };
    const remaining = order.amount - refund;
    const split = splitAmount(remaining, Number(order.fee_percent));
    const { data: updated } = await admin
      .from("orders")
      .update({ escrow_status: "released", refund_amount: refund, refunded_at: now, released_at: now, ...split })
      .eq("id", order.id)
      .eq("escrow_status", "held")
      .select()
      .maybeSingle();
    if (!updated) return { ok: false as const, reason: "Order changed, try again" };
    await admin.from("tasks").update({ status: "completed", completed_at: now }).eq("id", taskId);
  }

  const handled = await issueProviderRefund(order, refund);
  const link = `/tasks/${taskId}`;
  await Promise.all([
    notify({
      userId: order.client_id,
      type: "dispute",
      title: `Refund of ${formatMoney(refund)} approved`,
      body:
        handled === "sent"
          ? `${opts.reason} The refund has been sent to your card. Banks usually show it within 5 to 10 working days.`
          : `${opts.reason} Our team will send the refund to you within 3 working days.`,
      link,
    }),
    notify({
      userId: order.expert_id,
      type: "dispute",
      title: full ? "Order refunded to the client" : `Partial refund: ${formatMoney(refund)} returned to the client`,
      body: opts.reason,
      link,
    }),
  ]);
  return { ok: true as const, refund, handled };
}
