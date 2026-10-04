import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { HumanMadeBadge } from "@/components/seal";
import { STATUS_LABEL, formatDate } from "@/lib/format";
import { adminPath } from "@/lib/admin-path";
import type { Task, TaskStatus } from "@/lib/types";

export const metadata: Metadata = { title: "All tasks" };

export default async function AdminTasks({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const db = createAdminClient();
  let query = db.from("tasks").select("*, categories(name)").order("updated_at", { ascending: false }).limit(100);
  if (status && status in STATUS_LABEL) query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const tasks = (data ?? []) as (Task & { categories: { name: string } | null })[];
  const expertIds = Array.from(new Set(tasks.map((t) => t.expert_id).filter(Boolean))) as string[];
  const { data: people } = expertIds.length ? await db.from("users").select("id, full_name").in("id", expertIds) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name || "Expert"]));

  return (
    <>
      <PageHeader title="All tasks" description="Open any task to see its quotes, files, payments and every conversation." />
      <form className="mb-5 flex flex-col gap-2 sm:flex-row" action={adminPath("/tasks")}>
        <input name="q" defaultValue={q} placeholder="Search titles" className="input sm:max-w-sm" aria-label="Search titles" />
        <select name="status" defaultValue={status ?? ""} className="input sm:max-w-[200px]" aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button className="h-11 rounded-control bg-ink px-4 font-semibold text-white">Filter</button>
      </form>
      {tasks.length === 0 ? (
        <EmptyState title="No tasks match" />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-thread bg-paper text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Expert</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-thread">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-paper">
                  <td className="max-w-[320px] px-4 py-3">
                    <Link href={`/tasks/${t.id}`} className="block truncate font-medium hover:underline">{t.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{t.categories?.name}</td>
                  <td className="px-4 py-3 text-muted">{t.expert_id ? names.get(t.expert_id) ?? "Expert" : <span className="font-semibold text-amber">Unassigned</span>}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1"><StatusBadge status={t.status} />{t.status === "completed" && !t.ai_confirmed && <HumanMadeBadge />}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
