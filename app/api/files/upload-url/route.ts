import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, jsonError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import {
  BUCKETS,
  MAX_CHAT_BYTES,
  MAX_PORTFOLIO_BYTES,
  MAX_UPLOAD_BYTES,
  checkTaskUpload,
  loadTask,
  newObjectPath,
  userCanViewTask,
} from "@/lib/files";

const schema = z.object({
  kind: z.enum(["brief", "draft", "final", "report", "chat", "portfolio"]),
  taskId: z.string().uuid().optional(),
  threadExpertId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

/** Issues a one-time signed upload URL after checking the caller may upload here. */
export async function POST(request: Request) {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid upload request.");
  const { kind, taskId, threadExpertId, fileName, size } = parsed.data;

  let bucket: string;
  let path: string;

  if (kind === "portfolio") {
    if (size > MAX_PORTFOLIO_BYTES) return jsonError("Portfolio files can be up to 20 MB.");
    bucket = BUCKETS.portfolio;
    path = newObjectPath(user.id, fileName);
  } else {
    if (!taskId) return jsonError("Missing task.");
    const task = await loadTask(taskId);
    if (!task) return jsonError("Task not found.", 404);

    if (kind === "chat") {
      if (size > MAX_CHAT_BYTES) return jsonError("Chat files can be up to 25 MB.");
      const thread = threadExpertId ?? (user.profile.role === "expert" ? user.id : undefined);
      if (!thread) return jsonError("Missing conversation.");
      const member = task.client_id === user.id || (thread === user.id && (await userCanViewTask(task.id))) || user.profile.role === "admin";
      if (!member) return jsonError("You are not part of this conversation.", 403);
      bucket = BUCKETS.chat;
      path = newObjectPath(`${task.id}/${thread}`, fileName);
    } else {
      if (size > MAX_UPLOAD_BYTES) return jsonError("Files can be up to 100 MB.");
      const problem = await checkTaskUpload(user, task, kind);
      if (problem) return jsonError(problem, 403);
      bucket = BUCKETS.task;
      path = newObjectPath(`${task.id}/${kind}`, fileName);
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return jsonError(error?.message || "Could not prepare the upload.", 500);
  return NextResponse.json({ bucket, path: data.path, token: data.token, signedUrl: data.signedUrl });
}
