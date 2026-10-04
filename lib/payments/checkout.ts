import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth";
import type { Order } from "@/lib/types";

export async function loadOrderForParty(orderId: string, user: CurrentUser): Promise<Order | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  const order = data as Order | null;
  if (!order) return null;
  if (order.client_id !== user.id && order.expert_id !== user.id && user.profile.role !== "admin") return null;
  return order;
}
