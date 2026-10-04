import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export type NotificationType =
  | "new_quote"
  | "payment_received"
  | "delivery"
  | "revision_request"
  | "new_message"
  | "task_completed"
  | "dispute"
  | "expert_review"
  | "payout"
  | "account";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  email?: boolean;
}

/** Creates an in-app notification and (optionally) sends the same notice by email. Never throws. */
export async function notify(input: NotifyInput) {
  const admin = createAdminClient();
  try {
    await admin.from("notifications").insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
    if (input.email !== false) {
      const { data: user } = await admin.from("users").select("email, full_name").eq("id", input.userId).single();
      if (user?.email) await sendEmail(user.email, input.title, emailHtml(user.full_name, input));
    }
  } catch (err) {
    console.error("notify failed", err);
  }
}

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "ZeroAI Hub <notifications@example.com>";
  if (!key) {
    console.info(`[email skipped: RESEND_API_KEY not set] to=${to} subject=${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailHtml(name: string | null, input: NotifyInput) {
  const link = input.link ? `${env.siteUrl()}${input.link}` : env.siteUrl();
  return `<!doctype html><html><body style="margin:0;background:#F5F6F8;font-family:Arial,Helvetica,sans-serif;color:#14213D">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #D9DEE7;border-radius:14px">
  <tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:bold">ZeroAI Hub</td></tr>
  <tr><td style="padding:8px 28px;font-size:15px;line-height:1.6">
    <p style="margin:0 0 12px">Hi ${escapeHtml(name || "there")},</p>
    <p style="margin:0 0 8px;font-weight:bold">${escapeHtml(input.title)}</p>
    ${input.body ? `<p style="margin:0 0 16px;color:#5B6578">${escapeHtml(input.body)}</p>` : ""}
    <p style="margin:20px 0"><a href="${link}" style="background:#14213D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Open in ZeroAI Hub</a></p>
  </td></tr>
  <tr><td style="padding:16px 28px 28px;font-size:12px;color:#5B6578">Real work by real people. Zero AI.</td></tr>
  </table></td></tr></table></body></html>`;
}
