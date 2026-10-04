import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { decideTaskFileDownload, loadTask } from "@/lib/files";
import { env } from "@/lib/env";
import type { TaskFile } from "@/lib/types";

/** Redirects to a short-lived signed URL for a task file (original or watermarked preview). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const wantPreview = new URL(request.url).searchParams.get("variant") === "preview";

  const admin = createAdminClient();
  const { data: file } = await admin.from("task_files").select("*").eq("id", id).maybeSingle();
  if (!file) return jsonError("File not found.", 404);
  const task = await loadTask(file.task_id);
  if (!task) return jsonError("File not found.", 404);

  const decision = await decideTaskFileDownload(user, file as TaskFile, task, wantPreview);
  if (!decision.ok) return jsonError(decision.error, decision.status);

  const { data, error } = await admin.storage
    .from(decision.bucket)
    .createSignedUrl(decision.path, env.signedUrlSeconds(), decision.inline ? undefined : { download: decision.fileName });
  if (error || !data) return jsonError("Could not create a download link.", 500);
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
