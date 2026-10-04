"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import { refundEscrow, releaseEscrow } from "@/lib/payments/escrow";
import { getSettings } from "@/lib/settings";
import { temporaryPassword } from "@/lib/passwords";
import type { Task } from "@/lib/types";
import { dollarsToCents, formatMoney } from "@/lib/format";
import type { ActionResult } from "@/lib/types";

async function admin() {
  const user = await requireRole("admin");
  return { user, db: createAdminClient() };
}

// ---- Experts -------------------------------------------------------------

export async function reviewExpert(userId: string, decision: "approved" | "rejected" | "suspended", note: string): Promise<ActionResult> {
  const { user, db } = await admin();
  if (decision !== "approved" && note.trim().length < 5) return { ok: false, error: "Add a short reason for the expert." };
  const { error } = await db
    .from("expert_profiles")
    .update({ status: decision, review_note: note.trim() || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  const titles = {
    approved: "You're approved as a ZeroAI Hub expert",
    rejected: "Your expert application wasn't approved",
    suspended: "Your expert account has been suspended",
  };
  await notify({
    userId,
    type: "account",
    title: titles[decision],
    body: decision === "approved" ? "You can now browse tasks in your categories and send quotes." : note.trim(),
    link: "/expert",
  });
  revalidatePath("/admin/experts");
  return { ok: true, message: `Expert ${decision}.` };
}

// ---- Disputes ------------------------------------------------------------

export async function resolveDispute(
  disputeId: string,
  resolution: "refund" | "partial_refund" | "release",
  refundAmount: string,
  note: string,
): Promise<ActionResult> {
  const { user, db } = await admin();
  const { data: dispute } = await db.from("disputes").select("*, orders(amount)").eq("id", disputeId).single();
  if (!dispute || dispute.status !== "open") return { ok: false, error: "This dispute is already resolved." };
  const orderAmount = (dispute.orders as { amount: number } | null)?.amount ?? 0;
  if (note.trim().length < 5) return { ok: false, error: "Explain the decision for both parties." };

  let refund: number | null = null;
  if (resolution === "partial_refund") {
    refund = dollarsToCents(refundAmount);
    if (!Number.isFinite(refund) || refund <= 0 || refund >= orderAmount) {
      return { ok: false, error: `Enter a partial refund between $0.01 and ${formatMoney(orderAmount - 1)}.` };
    }
  }

  const result =
    resolution === "release"
      ? await releaseEscrow(dispute.task_id)
      : await refundEscrow(dispute.task_id, { amount: refund ?? undefined, reason: `Dispute decision: ${note.trim()}` });
  if (!result.ok) return { ok: false, error: result.reason };

  await db
    .from("disputes")
    .update({
      status: "resolved",
      resolution,
      refund_amount: resolution === "refund" ? orderAmount : refund,
      admin_note: note.trim(),
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);
  revalidatePath("/admin/disputes");
  revalidatePath(`/tasks/${dispute.task_id}`);
  return { ok: true, message: "Dispute resolved." };
}

// ---- AI audits -------------------------------------------------------------

export async function recordAudit(taskId: string, outcome: "clear" | "ai_confirmed", note: string): Promise<ActionResult> {
  const { user, db } = await admin();
  const { data: task } = await db.from("tasks").select("*").eq("id", taskId).single();
  if (!task) return { ok: false, error: "Task not found." };
  if (outcome === "ai_confirmed") {
    if (note.trim().length < 10) return { ok: false, error: "Record the evidence for AI use (at least 10 characters)." };
    const refund = await refundEscrow(taskId, { reason: "An audit confirmed AI was used, so you've been refunded in full." });
    if (!refund.ok && task.status !== "cancelled") return { ok: false, error: refund.reason };
    await db.from("tasks").update({ ai_confirmed: true, status: "cancelled" }).eq("id", taskId);
    if (task.expert_id) {
      await db
        .from("expert_profiles")
        .update({ status: "suspended", review_note: `AI use confirmed on task ${taskId}: ${note.trim()}`, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("user_id", task.expert_id);
      await notify({
        userId: task.expert_id,
        type: "account",
        title: "Your expert account has been suspended",
        body: `An audit of "${task.title}" confirmed AI use, which breaks the pledge you signed.`,
        link: "/expert",
      });
    }
  }
  await db.from("ai_audits").insert({ task_id: taskId, admin_id: user.id, outcome, note: note.trim() || null });
  revalidatePath("/admin/audits");
  return { ok: true, message: outcome === "clear" ? "Marked as human-made." : "AI use confirmed. Client refunded and expert suspended." };
}

// ---- Settings & categories ----------------------------------------------

const settingsSchema = z.object({
  task_price: z.coerce.number().min(1).max(100_000).transform((dollars) => Math.round(dollars * 100)),
  fee_percent: z.coerce.number().min(0).max(50),
  min_withdrawal: z.coerce.number().min(0).max(100_000).transform((dollars) => Math.round(dollars * 100)),
  auto_accept_days: z.coerce.number().int().min(1).max(30),
  revisions_included: z.coerce.number().int().min(0).max(10),
});

export async function updateSettings(input: Record<string, string>): Promise<ActionResult> {
  const { db } = await admin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { error } = await db.from("platform_settings").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved. The new price and fee apply to tasks quoted and paid from now on." };
}

export async function saveCategory(input: { id?: string; name: string; description: string; icon: string }): Promise<ActionResult> {
  const { db } = await admin();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Enter a category name." };
  const slug = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const row = { name, slug, description: input.description.trim() || null, icon: input.icon || "briefcase" };
  const { error } = input.id ? await db.from("categories").update(row).eq("id", input.id) : await db.from("categories").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "A category with that name exists." : error.message };
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true, message: "Category saved." };
}

export async function toggleCategory(id: string, active: boolean): Promise<ActionResult> {
  const { db } = await admin();
  await db.from("categories").update({ is_active: active }).eq("id", id);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true };
}

// ---- Users ---------------------------------------------------------------

export async function setBan(userId: string, banned: boolean, reason: string): Promise<ActionResult> {
  const { user, db } = await admin();
  if (userId === user.id) return { ok: false, error: "You can't ban yourself." };
  if (banned && reason.trim().length < 5) return { ok: false, error: "Add a reason for the ban." };
  const { error } = await db.from("users").update({ is_banned: banned, banned_reason: banned ? reason.trim() : null }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  // Also block sign-in at the auth layer (roughly 100 years) and end active sessions.
  await db.auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
  if (banned) await db.from("expert_profiles").update({ status: "suspended" }).eq("user_id", userId).eq("status", "approved");
  revalidatePath("/admin/users");
  return { ok: true, message: banned ? "User banned." : "User unbanned." };
}

// ---- Payouts -------------------------------------------------------------

export async function processPayout(payoutId: string, action: "mark_paid" | "reject", note: string): Promise<ActionResult> {
  const { db } = await admin();
  const { data: payout } = await db.from("payouts").select("*").eq("id", payoutId).single();
  if (!payout || !["requested", "processing"].includes(payout.status)) return { ok: false, error: "This payout is already processed." };

  if (action === "reject") {
    if (note.trim().length < 5) return { ok: false, error: "Add a reason for the expert." };
    await db.from("payouts").update({ status: "rejected", admin_note: note.trim(), processed_at: new Date().toISOString() }).eq("id", payoutId);
    await notify({ userId: payout.expert_id, type: "payout", title: "Your withdrawal was declined", body: note.trim(), link: "/expert/earnings" });
  } else {
    if (note.trim().length < 3) return { ok: false, error: "Add the transfer reference so the expert can trace it." };
    await db
      .from("payouts")
      .update({ status: "paid", admin_note: note.trim(), processed_at: new Date().toISOString() })
      .eq("id", payoutId);
    await notify({
      userId: payout.expert_id,
      type: "payout",
      title: `${formatMoney(payout.amount)} withdrawal sent`,
      body: `Reference: ${note.trim()}`,
      link: "/expert/earnings",
    });
  }
  revalidatePath("/admin/payouts");
  return { ok: true, message: "Payout updated." };
}

// ---- Expert accounts ------------------------------------------------------

const expertSchema = z.object({
  full_name: z.string().trim().min(3, "Enter the expert's full name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  headline: z.string().trim().max(120).default(""),
  skills: z.array(z.string().trim().min(1)).max(20).default([]),
  category_ids: z.array(z.string().uuid()).min(1, "Choose at least one category."),
});

/** Creates a ready-to-use expert login. Returns the temporary password once, for the admin to hand over. */
export async function createExpertAccount(input: z.input<typeof expertSchema>): Promise<ActionResult & { credentials?: { email: string; password: string; name: string } }> {
  const { user, db } = await admin();
  const parsed = expertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { data: existing } = await db.from("users").select("id").ilike("email", d.email).maybeSingle();
  if (existing) return { ok: false, error: "An account with this email already exists." };

  const password = temporaryPassword();
  const { data: created, error } = await db.auth.admin.createUser({
    email: d.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: d.full_name },
  });
  if (error || !created?.user) return { ok: false, error: error?.message || "Could not create the account." };
  const id = created.user.id;

  await db.from("users").upsert({ id, email: d.email, full_name: d.full_name, role: "expert" }, { onConflict: "id" });
  const { error: profileError } = await db.from("expert_profiles").insert({
    user_id: id,
    headline: d.headline,
    bio: "",
    skills: d.skills,
    category_ids: d.category_ids,
    status: "approved",
    created_by: user.id,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  });
  if (profileError) {
    await db.auth.admin.deleteUser(id);
    return { ok: false, error: profileError.message };
  }
  revalidatePath("/admin/experts");
  return { ok: true, message: "Expert account created.", credentials: { email: d.email, password, name: d.full_name } };
}

/** New temporary password; the expert must choose their own at next login. */
export async function resetExpertPassword(userId: string): Promise<ActionResult & { credentials?: { email: string; password: string; name: string } }> {
  const { db } = await admin();
  const { data: u } = await db.from("users").select("email, full_name, role").eq("id", userId).single();
  if (!u || u.role !== "expert" || !u.email) return { ok: false, error: "Expert not found." };
  const password = temporaryPassword();
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  await db.from("expert_profiles").update({ onboarded_at: null }).eq("user_id", userId);
  // No revalidate here: the page refreshes when the admin closes the credentials card,
  // so the new password stays on screen until it has been copied.
  return { ok: true, message: "Temporary password created.", credentials: { email: u.email, password, name: u.full_name || "" } };
}

export async function updateExpertProfile(userId: string, input: { headline: string; skills: string[]; category_ids: string[] }): Promise<ActionResult> {
  const { db } = await admin();
  if (!input.category_ids.length) return { ok: false, error: "Choose at least one category." };
  const { error } = await db
    .from("expert_profiles")
    .update({ headline: input.headline.trim().slice(0, 120), skills: input.skills.slice(0, 20), category_ids: input.category_ids })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/experts");
  return { ok: true, message: "Expert updated." };
}

// ---- Task control ---------------------------------------------------------

/**
 * Assigns a task to an expert.
 * Before payment: creates the expert's offer at the flat price and declines the others; the client then pays.
 * After payment: hands the work (and the escrowed payment) over to the new expert.
 */
export async function assignExpert(taskId: string, expertId: string, note: string): Promise<ActionResult> {
  const { db } = await admin();
  const [{ data: t }, { data: ep }, { data: eu }] = await Promise.all([
    db.from("tasks").select("*").eq("id", taskId).single(),
    db.from("expert_profiles").select("status").eq("user_id", expertId).maybeSingle(),
    db.from("users").select("full_name, is_banned").eq("id", expertId).maybeSingle(),
  ]);
  const task = t as Task | null;
  if (!task) return { ok: false, error: "Task not found." };
  if (!ep || ep.status !== "approved" || eu?.is_banned) return { ok: false, error: "Choose an active expert." };
  const expertName = eu?.full_name || "your expert";
  const link = `/tasks/${taskId}`;

  if (["draft", "open", "quoted"].includes(task.status)) {
    const { task_price } = await getSettings();
    // Deliver by the client's deadline, or in 3 days if the deadline has already passed.
    const deadline = new Date(task.deadline).getTime();
    const row = {
      price: task_price,
      delivery_date: new Date(deadline > Date.now() ? deadline : Date.now() + 3 * 86400_000).toISOString(),
      note: note.trim() || "Assigned to you by the ZeroAI Hub team.",
      status: "pending" as const,
      assigned_by_admin: true,
    };
    const { data: existing } = await db.from("quotes").select("id").eq("task_id", taskId).eq("expert_id", expertId).maybeSingle();
    const { error } = existing
      ? await db.from("quotes").update(row).eq("id", existing.id)
      : await db.from("quotes").insert({ ...row, task_id: taskId, expert_id: expertId });
    if (error) return { ok: false, error: error.message };
    await db.from("quotes").update({ status: "declined" }).eq("task_id", taskId).neq("expert_id", expertId).eq("status", "pending");
    await db.from("tasks").update({ status: "quoted", ...(task.status === "draft" ? { published_at: new Date().toISOString() } : {}) }).eq("id", taskId);
    await Promise.all([
      notify({ userId: task.client_id, type: "new_quote", title: `We matched "${task.title}" with ${expertName}`, body: `Pay ${formatMoney(task_price)} into escrow to get started.`, link }),
      notify({ userId: expertId, type: "new_quote", title: `You've been assigned "${task.title}"`, body: "Work starts as soon as the client pays into escrow.", link }),
    ]);
  } else if (["funded", "in_progress", "revision", "disputed"].includes(task.status)) {
    if (task.expert_id === expertId) return { ok: false, error: "That expert is already working on this task." };
    const previous = task.expert_id;
    await db.from("tasks").update({ expert_id: expertId }).eq("id", taskId);
    await db.from("orders").update({ expert_id: expertId }).eq("task_id", taskId).eq("escrow_status", "held");
    if (task.accepted_quote_id) await db.from("quotes").update({ expert_id: expertId, assigned_by_admin: true }).eq("id", task.accepted_quote_id);
    await Promise.all([
      notify({ userId: task.client_id, type: "account", title: `${expertName} is now working on "${task.title}"`, body: note.trim() || "The ZeroAI Hub team reassigned your task.", link }),
      notify({ userId: expertId, type: "payment_received", title: `You've been assigned "${task.title}"`, body: "Payment is already held in escrow. Read the brief and chat, then upload a draft.", link }),
      ...(previous ? [notify({ userId: previous, type: "account", title: `"${task.title}" was reassigned`, body: note.trim() || "The ZeroAI Hub team moved this task to another expert.", link: "/expert" })] : []),
    ]);
  } else {
    return { ok: false, error: "This task can't be reassigned now." };
  }
  revalidatePath(link);
  revalidatePath("/admin/tasks");
  return { ok: true, message: `Assigned to ${expertName}.` };
}

/** Admin override: accept the work on the client's behalf and pay the expert. */
export async function adminReleasePayment(taskId: string, note: string): Promise<ActionResult> {
  await admin();
  if (note.trim().length < 5) return { ok: false, error: "Add a short reason. Both parties will see it in their notifications." };
  const res = await releaseEscrow(taskId);
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, message: "Payment released and task completed." };
}

/** Admin override: cancel a task, refunding the client in full if they've paid. */
export async function adminCancelTask(taskId: string, note: string): Promise<ActionResult> {
  const { db } = await admin();
  if (note.trim().length < 5) return { ok: false, error: "Add a short reason. Both parties will see it." };
  const { data: order } = await db.from("orders").select("escrow_status").eq("task_id", taskId).maybeSingle();
  if (order?.escrow_status === "held") {
    const res = await refundEscrow(taskId, { reason: `Task cancelled by ZeroAI Hub: ${note.trim()}` });
    if (!res.ok) return { ok: false, error: res.reason };
  } else if (order?.escrow_status === "released") {
    return { ok: false, error: "This task is already paid out. Use the AI audit or contact the client about a refund." };
  } else {
    const { data: task } = await db.from("tasks").update({ status: "cancelled" }).eq("id", taskId).select("client_id, title").single();
    await db.from("quotes").update({ status: "declined" }).eq("task_id", taskId).eq("status", "pending");
    if (task) await notify({ userId: task.client_id, type: "account", title: `"${task.title}" was cancelled`, body: note.trim(), link: `/tasks/${taskId}` });
  }
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, message: "Task cancelled." };
}
