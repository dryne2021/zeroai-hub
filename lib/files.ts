import "server-only";
import crypto from "node:crypto";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth";
import type { FileKind, Task, TaskFile } from "@/lib/types";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_CHAT_BYTES = 25 * 1024 * 1024;
export const MAX_PORTFOLIO_BYTES = 20 * 1024 * 1024;

export const BUCKETS = {
  task: "task-files",
  previews: "previews",
  chat: "chat-files",
  portfolio: "portfolios",
} as const;

export type UploadKind = FileKind | "chat" | "portfolio";

export function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-120);
  return cleaned || "file";
}

export function newObjectPath(prefix: string, fileName: string) {
  return `${prefix}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}

export async function loadTask(taskId: string): Promise<Task | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("tasks").select("*").eq("id", taskId).maybeSingle();
  return (data as Task) ?? null;
}

/** Whether the user can see the task (uses the same SQL function as row-level security). */
export async function userCanViewTask(taskId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_view_task", { t: taskId });
  return Boolean(data);
}

export async function isActiveExpert(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("expert_profiles").select("status, onboarded_at").eq("user_id", userId).maybeSingle();
  return data?.status === "approved" && Boolean(data.onboarded_at);
}

/** Returns an error message, or null when the user may upload this kind of file to the task. */
export async function checkTaskUpload(user: CurrentUser, task: Task, kind: FileKind): Promise<string | null> {
  if (user.profile.is_banned) return "Your account is suspended.";
  if (kind === "brief") {
    if (task.client_id !== user.id) return "Only the client can attach brief files.";
    if (!["draft", "open", "quoted"].includes(task.status)) return "Brief files can't be changed after funding.";
    return null;
  }
  if (kind === "report") {
    // AI & plagiarism reports: added by the hired expert or the ZeroAI Hub team, any time after payment.
    const allowed = user.profile.role === "admin" || (task.expert_id === user.id && (await isActiveExpert(user.id)));
    if (!allowed) return "Only the hired expert or the ZeroAI Hub team can add reports.";
    if (!["funded", "in_progress", "revision", "delivered", "completed", "disputed"].includes(task.status)) return "Reports can be added once the task is paid for.";
    return null;
  }
  if (task.expert_id !== user.id) return "Only the hired expert can upload work files.";
  if (!(await isActiveExpert(user.id))) return "Your expert account is not active.";
  if (!["funded", "in_progress", "revision"].includes(task.status)) return "Work files can only be uploaded while the task is in progress.";
  if (kind === "final") {
    const admin = createAdminClient();
    const { count } = await admin.from("task_files").select("id", { count: "exact", head: true }).eq("task_id", task.id).eq("kind", "draft");
    if (!count) return "Upload at least one draft before the final file.";
  }
  return null;
}

export type DownloadDecision =
  | { ok: true; bucket: string; path: string; fileName: string; inline: boolean }
  | { ok: false; status: number; error: string };

/** Decides which object (original or watermarked preview) a user may fetch. */
export async function decideTaskFileDownload(user: CurrentUser, file: TaskFile, task: Task, wantPreview: boolean): Promise<DownloadDecision> {
  const admin = createAdminClient();
  const isAdmin = user.profile.role === "admin";
  const original = { ok: true as const, bucket: BUCKETS.task, path: file.storage_path, fileName: file.file_name, inline: false };
  const preview = (): DownloadDecision =>
    file.preview_status === "ready" && file.preview_path
      ? {
          ok: true,
          bucket: BUCKETS.previews,
          path: file.preview_path,
          fileName: `preview-${file.file_name.replace(/\.[^.]+$/, "")}.${file.preview_path.split(".").pop()}`,
          inline: true,
        }
      : { ok: false, status: 404, error: "No preview is available for this file. Ask the expert in chat for a sample." };

  if (wantPreview) {
    if (isAdmin || file.uploader_id === user.id || task.client_id === user.id) return preview();
    return { ok: false, status: 403, error: "Not allowed" };
  }
  if (isAdmin || file.uploader_id === user.id) return original;
  // Reports are proof of originality: both parties can open them at any time.
  if (file.kind === "report" && (task.client_id === user.id || task.expert_id === user.id)) return { ...original, inline: true };

  if (file.kind === "brief") {
    return (await userCanViewTask(task.id)) ? original : { ok: false, status: 403, error: "Not allowed" };
  }
  if (task.client_id === user.id) {
    if (file.kind === "final") {
      const { data: order } = await admin.from("orders").select("escrow_status").eq("task_id", task.id).maybeSingle();
      if (order?.escrow_status === "released" && task.status === "completed") return original;
      return { ok: false, status: 403, error: "The final file unlocks after you accept the work." };
    }
    return preview();
  }
  return { ok: false, status: 403, error: "Not allowed" };
}
