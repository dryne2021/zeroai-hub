"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function submitReview(taskId: string, rating: number, comment: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Choose a rating from 1 to 5 stars." };
  const admin = createAdminClient();
  const { data: task } = await admin.from("tasks").select("client_id, expert_id, status").eq("id", taskId).single();
  if (!task || task.status !== "completed" || !task.expert_id) return { ok: false, error: "You can rate once the task is completed." };
  let reviewee: string;
  if (user.id === task.client_id) reviewee = task.expert_id;
  else if (user.id === task.expert_id) reviewee = task.client_id;
  else return { ok: false, error: "Only the client and expert can rate this task." };

  const { error } = await admin.from("reviews").insert({
    task_id: taskId,
    reviewer_id: user.id,
    reviewee_id: reviewee,
    rating,
    comment: comment.trim().slice(0, 1000),
  });
  if (error) return { ok: false, error: error.code === "23505" ? "You've already rated this task." : error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, message: "Thanks for your rating." };
}
