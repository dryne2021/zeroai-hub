"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { isActiveExpert } from "@/lib/files";
import type { ActionResult } from "@/lib/types";

const schema = z.object({
  taskId: z.string().uuid(),
  delivery_date: z.string().min(1, "Choose a delivery date."),
  note: z.string().trim().max(1000).default(""),
});

/** Experts apply to take a task. Every task has the same flat price, so they only choose a delivery date. */
export async function submitQuote(input: { taskId: string; delivery_date: string; note: string }): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { taskId, delivery_date, note } = parsed.data;
  if (!(await isActiveExpert(user.id))) return { ok: false, error: "Finish setting up your expert account first." };
  const price = (await getSettings()).task_price;
  const delivery = new Date(delivery_date);
  if (Number.isNaN(delivery.getTime()) || delivery.getTime() < Date.now()) return { ok: false, error: "Choose a delivery date in the future." };

  const admin = createAdminClient();
  const { data: task } = await admin.from("tasks").select("id, title, client_id, status, category_id").eq("id", taskId).single();
  if (!task || !["open", "quoted"].includes(task.status)) return { ok: false, error: "This task is no longer taking quotes." };

  const supabase = await createClient();
  const { data: eligible } = await supabase.rpc("is_approved_expert_for", { cat: task.category_id });
  if (!eligible) return { ok: false, error: "Only approved experts in this category can quote." };

  const { data: existing } = await admin.from("quotes").select("id, status").eq("task_id", taskId).eq("expert_id", user.id).maybeSingle();
  const row = { price, delivery_date: delivery.toISOString(), note, status: "pending" as const };
  const { error } = existing
    ? await admin.from("quotes").update(row).eq("id", existing.id).in("status", ["pending", "withdrawn"])
    : await supabase.from("quotes").insert({ ...row, task_id: taskId, expert_id: user.id });
  if (error) return { ok: false, error: error.message };

  await notify({
    userId: task.client_id,
    type: "new_quote",
    title: existing ? `An expert updated their offer on "${task.title}"` : `An expert wants to take on "${task.title}"`,
    body: `${formatMoney(price)} flat, delivered by ${delivery.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}.`,
    link: `/tasks/${taskId}`,
  });
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, message: existing ? "Offer updated." : "Offer sent to the client." };
}

export async function withdrawQuote(quoteId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .update({ status: "withdrawn" })
    .eq("id", quoteId)
    .eq("expert_id", user.id)
    .eq("status", "pending")
    .select("task_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "This quote can't be withdrawn." };
  revalidatePath(`/tasks/${data.task_id}`);
  return { ok: true, message: "Quote withdrawn." };
}
