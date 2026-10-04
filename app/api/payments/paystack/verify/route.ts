import { NextResponse } from "next/server";
import { confirmPaystackReference } from "@/lib/payments/paystack-confirm";
import { env } from "@/lib/env";

/** Paystack redirects the client here after the card checkout. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const reference = params.get("reference") || params.get("trxref");
  if (!reference) return NextResponse.redirect(`${env.siteUrl()}/client`);
  try {
    const { taskId, paid } = await confirmPaystackReference(reference);
    if (!taskId) return NextResponse.redirect(`${env.siteUrl()}/client`);
    return NextResponse.redirect(`${env.siteUrl()}/tasks/${taskId}?payment=${paid ? "success" : "failed"}`);
  } catch {
    return NextResponse.redirect(`${env.siteUrl()}/client?payment=error`);
  }
}
