"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { passwordProblem } from "@/lib/passwords";
import type { ActionResult } from "@/lib/types";

/** First login for an admin-created expert: replace the temporary password and sign the no-AI pledge. */
export async function completeOnboarding(input: {
  password: string;
  confirm: string;
  pledge: boolean;
  signature: string;
}): Promise<ActionResult> {
  const user = await requireRole("expert");
  const db = createAdminClient();
  const { data: profile } = await db.from("expert_profiles").select("pledge_signed_at, status").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.status !== "approved") return { ok: false, error: "Your expert account isn't active." };

  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, error: problem };
  if (input.password !== input.confirm) return { ok: false, error: "The two passwords don't match." };
  if (!profile.pledge_signed_at) {
    if (!input.pledge) return { ok: false, error: "Agree to the no-AI pledge to continue." };
    const name = (user.profile.full_name || "").trim().toLowerCase();
    if (!name || input.signature.trim().toLowerCase() !== name) return { ok: false, error: `Sign by typing your full name exactly: ${user.profile.full_name}` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return { ok: false, error: error.message };

  const now = new Date().toISOString();
  await db
    .from("expert_profiles")
    .update({ onboarded_at: now, ...(profile.pledge_signed_at ? {} : { pledge_signed_at: now, pledge_version: "v2" }) })
    .eq("user_id", user.id);
  revalidatePath("/expert");
  return { ok: true, message: "You're all set.", redirect: "/expert" };
}
