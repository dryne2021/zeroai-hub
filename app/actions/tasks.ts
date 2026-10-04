"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { releaseEscrow } from "@/lib/payments/escrow";
import { notify } from "@/lib/notify";
import type { ActionResult, Task } from "@/lib/types";

const taskSchema = z.object({
  title: z.string().trim().min(5, "Give the task a title of at least 5 characters.").max(140),
  category_id: z.string().uuid("Choose a category."),
  description: z.string().trim().min(20, "Describe the task in at least 20 characters.").max(8000),
  deadline: z.string().min(1, "Choose a deadline."),
});

export async function createTask(input: {
  title: string;
  category_id: string;
  description: string;
  deadline: string;
}): Promise<ActionResult & { taskId?: string }> {
  const user = await requireUser();
  if (user.profile.role !== "client") return { ok: false, error: "Only client accounts can post tasks." };
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const deadline = new Date(parsed.data.deadline);
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() < Date.now() + 3600_000) {
    return { ok: false, error: "Pick a deadline at least an hour from now." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      client_id: user.id,
      title: parsed.data.title,
      category_id: parsed.data.category_id,
      description: parsed.data.description,
      deadline: deadline.toISOString(),
      coursework_confirmed: true,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Could not save the task." };
  revalidatePath("/client");
  return { ok: true, taskId: data.id };
}

export async function publishTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "open", published_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("client_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "This task can't be published." };
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/client");
  return { ok: true, message: "Task published. Experts in this category can now send quotes." };
}

export async function cancelTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from("tasks")
    .update({ status: "cancelled" })
    .eq("id", taskId)
    .eq("client_id", user.id)
    .in("status", ["draft", "open", "quoted"])
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false, error: "Only unfunded tasks can be cancelled." };
  await admin.from("quotes").update({ status: "declined" }).eq("task_id", taskId).eq("status", "pending");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, message: "Task cancelled." };
}

async function loadClientTask(taskId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("tasks").select("*").eq("id", taskId).single();
  const task = data as Task | null;
  if (!task || task.client_id !== userId) return null;
  return task;
}

export async function acceptDelivery(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const task = await loadClientTask(taskId, user.id);
  if (!task) return { ok: false, error: "Task not found." };
  if (task.status !== "delivered") return { ok: false, error: "There's no delivery waiting for your review." };
  const res = await releaseEscrow(taskId);
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, message: "Work accepted. Your final file is unlocked." };
}

export async function requestRevision(taskId: string, note: string): Promise<ActionResult> {
  const user = await requireUser();
  const task = await loadClientTask(taskId, user.id);
  if (!task || !task.expert_id) return { ok: false, error: "Task not found." };
  if (task.status !== "delivered") return { ok: false, error: "You can request a revision once work is delivered." };
  if (task.revisions_used >= task.revisions_included) {
    return { ok: false, error: "You've used the included revisions. Accept the work or open a dispute." };
  }
  const clean = note.trim();
  if (clean.length < 10) return { ok: false, error: "Tell the expert what to change (at least 10 characters)." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("tasks")
    .update({ status: "revision", revisions_used: task.revisions_used + 1, delivered_at: null })
    .eq("id", taskId)
    .eq("status", "delivered")
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false, error: "The task changed. Refresh and try again." };

  const supabase = await createClient();
  await supabase.from("messages").insert({
    task_id: taskId,
    expert_id: task.expert_id,
    sender_id: user.id,
    body: `Revision request ${task.revisions_used + 1} of ${task.revisions_included}:\n${clean}`,
  });
  await notify({
    userId: task.expert_id,
    type: "revision_request",
    title: `Revision requested on "${task.title}"`,
    body: clean.slice(0, 300),
    link: `/tasks/${taskId}`,
  });
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, message: "Revision requested. The expert has been notified." };
}
