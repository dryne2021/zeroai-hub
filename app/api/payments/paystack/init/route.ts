import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, jsonError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { prepareOrder, logPaymentEvent } from "@/lib/payments/escrow";
import { initializeTransaction, paystackConfigured } from "@/lib/payments/paystack";
import { env } from "@/lib/env";

const schema = z.object({ taskId: z.string().uuid(), quoteId: z.string().uuid() });

/** Creates a Paystack card checkout and returns the hosted payment page URL. */
export async function POST(request: Request) {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  if (!paystackConfigured()) return jsonError("Card payments are not configured yet.", 503);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request.");
  const email = user.email || user.profile.email;
  if (!email) return jsonError("Add an email address to your account to pay by card.");

  try {
    const order = await prepareOrder(parsed.data.taskId, parsed.data.quoteId, user.id);
    const reference = `ZAH_${order.id.slice(0, 8)}_${Date.now()}`;
    const init = await initializeTransaction({
      email,
      amountCents: order.amount,
      reference,
      callbackUrl: `${env.siteUrl()}/api/payments/paystack/verify`,
      metadata: { order_id: order.id, task_id: order.task_id },
    });
    await logPaymentEvent(order.id, "paystack", "initialize", { reference });
    await createAdminClient()
      .from("orders")
      .update({ payment_method: "card", payment_status: "initiated", provider_reference: reference })
      .eq("id", order.id)
      .eq("escrow_status", "pending");
    return NextResponse.json({ url: init.authorization_url });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not start card payment.");
  }
}
