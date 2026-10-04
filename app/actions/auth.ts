"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { passwordProblem, safeEqual } from "@/lib/passwords";
import { env } from "@/lib/env";
import type { ActionResult, Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { client: "client", expert: "expert", admin: "admin" };

/**
 * Makes sure the admin account named in ADMIN_EMAIL exists, has ADMIN_PASSWORD as its password,
 * and has the admin role. Runs only when someone logs in on the Admin tab with exactly those details.
 */
async function ensureAdminAccount(email: string, password: string) {
  const db = createAdminClient();
  const { data: existing } = await db.from("users").select("id").ilike("email", email).maybeSingle();
  let id = existing?.id as string | undefined;

  if (!id) {
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "ZeroAI Hub Admin" },
    });
    if (created?.user) id = created.user.id;
    else if (error) {
      // The auth account exists without a profile row; find it.
      const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      id = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    }
  }
  if (!id) throw new Error("Could not create the admin account.");

  await db.auth.admin.updateUserById(id, { password, email_confirm: true, ban_duration: "none" });
  await db.from("users").upsert({ id, email, role: "admin", is_banned: false, banned_reason: null }, { onConflict: "id" });
}

export async function signInAs(input: { role: Role; email: string; password: string; next?: string }): Promise<ActionResult> {
  const role = input.role;
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !password) return { ok: false, error: "Enter your email and password." };

  const supabase = await createClient();
  const attempt = () => supabase.auth.signInWithPassword({ email, password });
  let { data, error } = await attempt();

  // First admin login (or a forgotten admin password): use the credentials kept in Vercel.
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const matchesAdminEnv = role === "admin" && adminEmail && adminPassword && email === adminEmail && safeEqual(password, adminPassword);
  if (matchesAdminEnv) {
    const { data: row } = data.user
      ? await createAdminClient().from("users").select("role").eq("id", data.user.id).maybeSingle()
      : { data: null };
    if (error || row?.role !== "admin") {
      await supabase.auth.signOut();
      await ensureAdminAccount(email, password);
      ({ data, error } = await attempt());
    }
  }

  if (error || !data.user) {
    const msg = error?.message || "";
    if (/confirm/i.test(msg)) return { ok: false, error: "Confirm your email first. Check your inbox for the link we sent." };
    return { ok: false, error: "That email and password don't match an account." };
  }

  const { data: profile } = await createAdminClient().from("users").select("role, is_banned").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.is_banned) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is suspended. Contact support if you think this is a mistake." };
  }
  if (profile.role !== role) {
    await supabase.auth.signOut();
    if (role === "admin") return { ok: false, error: "These details don't belong to an admin account." };
    return {
      ok: false,
      error: `This is a${profile.role === "admin" || profile.role === "expert" ? "n" : ""} ${ROLE_LABEL[profile.role as Role]} account. Use the ${profile.role === "client" ? "Client" : profile.role === "expert" ? "Expert" : "Admin"} tab to log in.`,
    };
  }

  if (role === "expert") {
    const { data: ep } = await createAdminClient().from("expert_profiles").select("status, onboarded_at").eq("user_id", data.user.id).maybeSingle();
    if (!ep || ep.status === "suspended" || ep.status === "rejected") {
      await supabase.auth.signOut();
      return { ok: false, error: "Your expert account isn't active. Contact the ZeroAI Hub team." };
    }
    if (!ep.onboarded_at) return { ok: true, redirect: "/expert/welcome" };
  }

  const home = homeFor(role);
  const next = safeNext(input.next, home);
  const allowed = role === "admin" ? true : role === "expert" ? !next.startsWith("/admin") && !next.startsWith("/client") : !next.startsWith("/admin") && !next.startsWith("/expert");
  return { ok: true, redirect: allowed && next !== "/dashboard" ? next : home };
}

export async function requestPasswordReset(emailInput: string): Promise<ActionResult> {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.siteUrl()}/auth/callback?next=/reset-password` });
  // Same answer whether or not the account exists, so emails can't be probed.
  return { ok: true, message: "If that email has an account, a reset link is on its way." };
}

export async function setNewPassword(password: string, confirm: string): Promise<ActionResult> {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  if (password !== confirm) return { ok: false, error: "The two passwords don't match." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  const { data: profile } = await createAdminClient().from("users").select("role").eq("id", auth.user.id).maybeSingle();
  return { ok: true, message: "Password updated.", redirect: homeFor((profile?.role as Role) || "client") };
}
