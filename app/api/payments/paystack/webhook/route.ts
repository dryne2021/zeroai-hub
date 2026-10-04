import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { confirmPaystackReference } from "@/lib/payments/paystack-confirm";
import { logPaymentEvent } from "@/lib/payments/escrow";

/** Paystack webhook (set the URL in your Paystack dashboard). Signed with your secret key. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const event = JSON.parse(raw) as { event: string; data?: { reference?: string } };
  await logPaymentEvent(null, "paystack", `webhook:${event.event}`, { reference: event.data?.reference });
  if (event.event === "charge.success" && event.data?.reference) {
    await confirmPaystackReference(event.data.reference).catch(() => null);
  }
  return NextResponse.json({ received: true });
}
