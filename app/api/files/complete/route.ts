import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, jsonError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { BUCKETS, MAX_UPLOAD_BYTES, checkTaskUpload, loadTask } from "@/lib/files";
import { generatePreview } from "@/lib/preview";
import { notify } from "@/lib/notify";

export const maxDuration = 60;

const schema = z.object({
  taskId: z.string().uuid(),
  kind: z.enum(["brief", "draft", "final", "report"]),
  path: z.string().min(10),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(200).optional().default(""),
  note: z.string().max(500).optional().default(""),
});

/** Records an uploaded task file, versions it, builds the client preview and moves the task forward. */
export async function POST(request: Request) {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request.");
  const { taskId, kind, path, fileName, mimeType, note } = parsed.data;

  const task = await loadTask(taskId);
  if (!task) return jsonError("Task not found.", 404);
  const problem = await checkTaskUpload(user, task, kind);
  if (problem) return jsonError(problem, 403);
  if (!path.startsWith(`${taskId}/${kind}/`) || path.includes("..")) return jsonError("Invalid file path.");

  const admin = createAdminClient();
  const dir = path.slice(0, path.lastIndexOf("/"));
  const objectName = path.slice(path.lastIndexOf("/") + 1);
  const { data: listing } = await admin.storage.from(BUCKETS.task).list(dir, { search: objectName, limit: 1 });
  const object = listing?.find((o) => o.name === objectName);
  if (!object) return jsonError("Upload not found. Try again.", 404);
  const size = Number((object.metadata as { size?: number } | null)?.size ?? 0);
  if (size > MAX_UPLOAD_BYTES) {
    await admin.storage.from(BUCKETS.task).remove([path]);
    return jsonError("Files can be up to 100 MB.");
  }

  const { data: last } = await admin
    .from("task_files")
    .select("version")
    .eq("task_id", taskId)
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: row, error } = await admin
    .from("task_files")
    .insert({
      task_id: taskId,
      uploader_id: user.id,
      kind,
      version: (last?.version ?? 0) + 1,
      storage_path: path,
      file_name: fileName,
      mime_type: mimeType || (object.metadata as { mimetype?: string } | null)?.mimetype || null,
      size_bytes: size,
      note: note || null,
    })
    .select()
    .single();
  if (error || !row) return jsonError(error?.message || "Could not save the file.", 500);

  if (kind === "brief") return NextResponse.json({ file: row });
  if (kind === "report") {
    await notify({
      userId: task.client_id,
      type: "delivery",
      title: `AI & plagiarism report added to "${task.title}"`,
      body: "Open the task to view the report.",
      link: `/tasks/${taskId}`,
    });
    return NextResponse.json({ file: row });
  }

  // Watermarked / partial preview for the client
  let previewStatus: "ready" | "unavailable" = "unavailable";
  let previewPath: string | null = null;
  const { data: blob } = await admin.storage.from(BUCKETS.task).download(path);
  if (blob) {
    const preview = await generatePreview(Buffer.from(await blob.arrayBuffer()), fileName, row.mime_type);
    if (preview) {
      previewPath = `${taskId}/${row.id}.${preview.extension}`;
      const up = await admin.storage.from(BUCKETS.previews).upload(previewPath, preview.buffer, {
        contentType: preview.contentType,
        upsert: true,
      });
      if (!up.error) previewStatus = "ready";
    }
  }
  await admin.from("task_files").update({ preview_path: previewPath, preview_status: previewStatus }).eq("id", row.id);

  const link = `/tasks/${taskId}`;
  if (kind === "draft") {
    if (["funded", "revision"].includes(task.status)) {
      await admin.from("tasks").update({ status: "in_progress" }).eq("id", taskId).in("status", ["funded", "revision"]);
    }
    await notify({
      userId: task.client_id,
      type: "delivery",
      title: `New draft for "${task.title}"`,
      body: "Open the task to see a watermarked preview and leave feedback in chat.",
      link,
      email: false,
    });
  } else {
    await admin
      .from("tasks")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", taskId)
      .in("status", ["funded", "in_progress", "revision"]);
    await notify({
      userId: task.client_id,
      type: "delivery",
      title: `Work delivered: "${task.title}"`,
      body: "Review the preview, then accept the work or request a revision. If you don't respond, it is accepted automatically after 5 days.",
      link,
    });
  }

  return NextResponse.json({ file: { ...row, preview_path: previewPath, preview_status: previewStatus } });
}
