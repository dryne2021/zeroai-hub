import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { BanControl } from "@/components/admin/forms";
import { formatDate } from "@/lib/format";
import { adminPath } from "@/lib/admin-path";
import type { UserRow } from "@/lib/types";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  await requireAdmin();
  const { q, role } = await searchParams;
  const me = await getCurrentUser();
  const db = createAdminClient();
  let query = db.from("users").select("*").order("created_at", { ascending: false }).limit(100);
  if (role && ["client", "expert", "admin"].includes(role)) query = query.eq("role", role);
  if (q) {
    const term = q.replace(/[%_,()]/g, "");
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  const { data } = await query;
  const users = (data ?? []) as UserRow[];

  return (
    <>
      <PageHeader title="Users" description="Banning blocks sign-in immediately and suspends any expert profile." />
      <form className="mb-5 flex flex-col gap-2 sm:flex-row" action={adminPath("/users")}>
        <input name="q" defaultValue={q} placeholder="Name, email or phone" className="input sm:max-w-sm" aria-label="Search users" />
        <select name="role" defaultValue={role ?? ""} className="input sm:max-w-[180px]" aria-label="Role">
          <option value="">All roles</option>
          <option value="client">Clients</option>
          <option value="expert">Experts</option>
          <option value="admin">Admins</option>
        </select>
        <button className="h-11 rounded-control bg-ink px-4 font-semibold text-white">Search</button>
      </form>
      {users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <ul className="panel divide-y divide-thread">
          {users.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {u.full_name || "Unnamed"}
                  <Badge tone={u.role === "admin" ? "info" : u.role === "expert" ? "seal" : "neutral"}>{u.role}</Badge>
                  {u.is_banned && <Badge tone="danger">Banned</Badge>}
                </p>
                <p className="truncate text-sm text-muted">
                  {u.email || u.phone}. Joined {formatDate(u.created_at)}.{u.banned_reason ? ` Reason: ${u.banned_reason}` : ""}
                </p>
              </div>
              {u.id !== me?.id && u.role !== "admin" && <BanControl userId={u.id} banned={u.is_banned} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
