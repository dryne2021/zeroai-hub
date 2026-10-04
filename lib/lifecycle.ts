import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { releaseEscrow } from "@/lib/payments/escrow";

/** Accepts every delivered task whose client hasn't responded within the auto-accept window. */
export async function runAutoAccept(taskId?: string) {
  const admin = createAdminClient();
  const { auto_accept_days } = await getSettings();
  const cutoff = new Date(Date.now() - auto_accept_days * 86400_000).toISOString();
  let query = admin.from("tasks").select("id").eq("status", "delivered").lt("delivered_at", cutoff).limit(200);
  if (taskId) query = query.eq("id", taskId);
  const { data } = await query;
  let accepted = 0;
  for (const t of data ?? []) {
    const r = await releaseEscrow(t.id, { auto: true });
    if (r.ok) accepted++;
  }
  return accepted;
}
