"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/notifications");
}

export async function updateProfile(fullName: string): Promise<ActionResult> {
  const user = await requireUser();
  const name = fullName.trim();
  if (name.length < 2) return { ok: false, error: "Enter your name." };
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ full_name: name.slice(0, 80) }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
