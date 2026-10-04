"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import type { ActionResult, Message } from "@/lib/types";

export async function sendMessage(input: {
  taskId: string;
  expertId: string;
  body: string;
  file?: { path: string; name: string; size: number } | null;
}): Promise<ActionResult & { sent?: Message }> {
  const user = await requireUser();
  const body = input.body.trim().slice(0, 4000);
  if (!body && !input.file) return { ok: false, error: "Write a message or attach a file." };
  if (input.file && !input.file.path.startsWith(`${input.taskId}/${input.expertId}/`)) {
    return { ok: false, error: "Invalid attachment." };
  }

  // Admins can write into any conversation as the ZeroAI Hub team.
  const isAdmin = user.profile.role === "admin";
  const supabase = isAdmin ? createAdminClient() : await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      task_id: input.taskId,
      expert_id: input.expertId,
      sender_id: user.id,
      body,
      file_path: input.file?.path ?? null,
      file_name: input.file?.name ?? null,
      file_size: input.file?.size ?? null,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: "You can't send messages in this conversation." };

  const admin = createAdminClient();
  const { data: task } = await admin.from("tasks").select("title, client_id").eq("id", input.taskId).single();
  if (task) {
    const recipients = isAdmin ? [task.client_id, input.expertId] : [user.id === task.client_id ? input.expertId : task.client_id];
    for (const recipient of recipients) {
      const link = `/tasks/${input.taskId}?thread=${input.expertId}`;
      // Email at most once per 30 minutes per conversation while messages stay unread.
      const since = new Date(Date.now() - 30 * 60_000).toISOString();
      const { count } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", recipient)
        .eq("type", "new_message")
        .eq("link", link)
        .gte("created_at", since);
      await notify({
        userId: recipient,
        type: "new_message",
        title: isAdmin ? `The ZeroAI Hub team sent a message about "${task.title}"` : `New message about "${task.title}"`,
        body: (data as Message).body.slice(0, 160) || "Sent a file",
        link,
        email: !count,
      });
    }
  }
  return { ok: true, sent: data as Message };
}

export async function markThreadRead(taskId: string, expertId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: visible } = await supabase.from("messages").select("id").eq("task_id", taskId).eq("expert_id", expertId).limit(1);
  if (!visible?.length) return;
  await createAdminClient()
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("expert_id", expertId)
    .neq("sender_id", user.id)
    .is("read_at", null);
}
