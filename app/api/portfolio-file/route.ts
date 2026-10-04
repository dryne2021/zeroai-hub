import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/files";
import { env } from "@/lib/env";

/** Portfolio samples are visible to the expert who uploaded them and to admins reviewing applications. */
export async function GET(request: Request) {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!path || path.includes("..")) return jsonError("Invalid path.");
  const owner = path.split("/")[0];
  if (owner !== user.id && user.profile.role !== "admin") return jsonError("Not allowed", 403);
  const { data } = await createAdminClient().storage.from(BUCKETS.portfolio).createSignedUrl(path, env.signedUrlSeconds());
  if (!data) return jsonError("File not found.", 404);
  return NextResponse.redirect(data.signedUrl);
}
