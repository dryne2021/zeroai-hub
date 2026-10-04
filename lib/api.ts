import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function apiUser(): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to continue.", 401);
  if (user.profile.is_banned) return jsonError("Your account is suspended.", 403);
  return user;
}
