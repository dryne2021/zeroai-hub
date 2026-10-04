import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/payments/paystack";
import { logPaymentEvent, markHeld, markPaymentFailed } from "@/lib/payments/escrow";

/** Verifies a Paystack reference with the API (never trusting the redirect alone) and moves money to escrow. */
export async function confirmPaystackReference(reference: string) {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, task_id").eq("provider_reference", reference).maybeSingle();
  if (!order) return { taskId: null, paid: false };
  const tx = await verifyTransaction(reference);
  await logPaymentEvent(order.id, "paystack", "verify", { status: tx.status, amount: tx.amount, currency: tx.currency });
  if (tx.status === "success") {
    await markHeld(order.id, { method: "card", reference, amountPaid: tx.amount, currency: tx.currency });
    return { taskId: order.task_id as string, paid: true };
  }
  if (["failed", "abandoned", "reversed"].includes(tx.status)) await markPaymentFailed(order.id, `Paystack: ${tx.status}`);
  return { taskId: order.task_id as string, paid: false };
}
