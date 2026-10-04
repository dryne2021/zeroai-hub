import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/files";
import { env } from "@/lib/env";

/** Chat attachments: row-level security on messages decides who may fetch the file. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const supabase = await createClient();
  const { data: message } = await supabase.from("messages").select("file_path, file_name").eq("id", id).maybeSingle();
  if (!message?.file_path) return jsonError("File not found.", 404);
  const { data } = await createAdminClient()
    .storage.from(BUCKETS.chat)
    .createSignedUrl(message.file_path, env.signedUrlSeconds(), { download: message.file_name || "file" });
  if (!data) return jsonError("Could not create a download link.", 500);
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
