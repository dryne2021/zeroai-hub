import "server-only";
import crypto from "node:crypto";

const BASE = process.env.PAYSTACK_API_BASE || "https://api.paystack.co";

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack is not configured: missing PAYSTACK_SECRET_KEY");
  return key;
}

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const json = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !json.status) throw new Error(json.message || `Paystack request failed (${res.status})`);
  return json.data;
}

/** Amounts are in US cents, which is the subunit Paystack expects for USD. */
export function initializeTransaction(args: {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: args.email,
      amount: Math.round(args.amountCents),
      currency: "USD",
      reference: args.reference,
      callback_url: args.callbackUrl,
      channels: ["card"],
      metadata: args.metadata,
    }),
  });
}

export function verifyTransaction(reference: string) {
  return call<{ status: string; amount: number; currency: string; reference: string; paid_at: string; metadata?: Record<string, unknown> }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
}

export function refundTransaction(reference: string, amountCents?: number) {
  return call<{ id: number; status: string }>("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: reference, ...(amountCents ? { amount: Math.round(amountCents) } : {}) }),
  });
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const hash = crypto.createHmac("sha512", secret()).update(rawBody).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
