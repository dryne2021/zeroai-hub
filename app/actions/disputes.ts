"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/lib/types";
import { adminPath } from "@/lib/admin-path";

export async function openDispute(taskId: string, reason: string, details: string): Promise<ActionResult> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: task } = await admin.from("tasks").select("*").eq("id", taskId).single();
  if (!task || (task.client_id !== user.id && task.expert_id !== user.id)) return { ok: false, error: "Task not found." };
  if (!["funded", "in_progress", "delivered", "revision"].includes(task.status)) {
    return { ok: false, error: "Disputes can be opened while payment is held in escrow." };
  }
  const { data: order } = await admin.from("orders").select("id, escrow_status").eq("task_id", taskId).single();
  if (!order || order.escrow_status !== "held") return { ok: false, error: "Payment has already been released." };
  if (reason.trim().length < 3) return { ok: false, error: "Choose a reason." };

  const { error } = await admin.from("disputes").insert({
    task_id: taskId,
    order_id: order.id,
    opened_by: user.id,
    reason: reason.trim().slice(0, 120),
    details: details.trim().slice(0, 4000),
  });
  if (error) return { ok: false, error: error.code === "23505" ? "A dispute is already open for this task." : error.message };
  await admin.from("tasks").update({ status: "disputed", status_before_dispute: task.status }).eq("id", taskId);

  const other = user.id === task.client_id ? task.expert_id : task.client_id;
  const link = `/tasks/${taskId}`;
  await notify({ userId: other, type: "dispute", title: `A dispute was opened on "${task.title}"`, body: reason, link });
  const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
  await Promise.all(
    (admins ?? []).map((a) =>
      notify({ userId: a.id, type: "dispute", title: `New dispute: "${task.title}"`, body: reason, link: adminPath("/disputes"), email: false }),
    ),
  );
  revalidatePath(link);
  return { ok: true, message: "Dispute opened. Payment stays in escrow until an admin decides." };
}
