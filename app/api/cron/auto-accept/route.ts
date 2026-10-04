import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runAutoAccept } from "@/lib/lifecycle";

/** Called daily by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = env.cronSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const accepted = await runAutoAccept();
  return NextResponse.json({ accepted });
}
