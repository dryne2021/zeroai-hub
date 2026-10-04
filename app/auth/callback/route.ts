import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/** Google sign-in, email confirmation and password-reset landing. Exchanges the code for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
