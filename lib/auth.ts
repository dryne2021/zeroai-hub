import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ExpertProfile, Role, UserRow } from "@/lib/types";
import { adminPath } from "@/lib/admin-path";

export type CurrentUser = { id: string; email: string | null; profile: UserRow };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? null, profile: profile as UserRow };
});

export async function requireUser(next?: string, role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const qs = new URLSearchParams();
    if (role) qs.set("role", role);
    if (next) qs.set("next", next);
    redirect(`/login${qs.size ? `?${qs}` : ""}`);
  }
  if (user.profile.is_banned) redirect("/banned");
  return user;
}

export async function requireRole(roles: Role | Role[], next?: string): Promise<CurrentUser> {
  const user = await requireUser(next, Array.isArray(roles) ? roles[0] : roles);
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.profile.role)) redirect("/dashboard");
  return user;
}

export const getExpertProfile = cache(async (userId: string): Promise<ExpertProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("expert_profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as ExpertProfile) ?? null;
});

export function homeFor(role: Role) {
  return role === "admin" ? adminPath() : role === "expert" ? "/expert" : "/client";
}

/**
 * Guard for admin pages. Call it at the top of every admin page (not only the layout),
 * because Next.js renders a page in parallel with its layout. Non-admins get a 404.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin" || user.profile.is_banned) notFound();
  return user;
}

/**
 * Guard for expert pages: an approved expert who has set their own password and signed the pledge.
 * New experts are sent to the welcome page first.
 */
export async function requireOnboardedExpert(next?: string) {
  const user = await requireRole("expert", next);
  const profile = await getExpertProfile(user.id);
  if (profile && profile.status === "approved" && !profile.onboarded_at) redirect("/expert/welcome");
  return { user, profile };
}
