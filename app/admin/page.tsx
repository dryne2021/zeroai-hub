import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, UserSearch } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { LinkButton, Notice, PageHeader, Panel, PanelHeader, Stat, StatusBadge } from "@/components/ui";
import { STATUS_LABEL, formatDate, formatMoney } from "@/lib/format";
import type { Task, TaskStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Admin" };

function TaskRows({ tasks, empty, meta }: { tasks: Task[]; empty: string; meta: (t: Task) => string }) {
  if (!tasks.length) return <p className="px-5 py-6 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-thread">
      {tasks.map((t) => (
        <li key={t.id}>
          <Link href={`/tasks/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-paper">
            <span className="min-w-0">
              <span className="block truncate font-medium">{t.title}</span>
              <span className="text-sm text-muted">{meta(t)}</span>
            </span>
            <StatusBadge status={t.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminOverview() {
  await requireAdmin();
  const db = createAdminClient();
  const now = new Date().toISOString();
  const [invited, disputes, payouts, orders, tasks, recent, unassigned, overdue, experts, clients] = await Promise.all([
    db.from("expert_profiles").select("user_id", { count: "exact", head: true }).eq("status", "approved").is("onboarded_at", null),
    db.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("payouts").select("amount").in("status", ["requested", "processing"]),
    db.from("orders").select("amount, fee_amount, escrow_status, refund_amount"),
    db.from("tasks").select("status"),
    db.from("tasks").select("*").neq("status", "draft").order("updated_at", { ascending: false }).limit(8),
    db.from("tasks").select("*").in("status", ["open", "quoted"]).order("published_at", { ascending: true }).limit(8),
    db.from("tasks").select("*").in("status", ["funded", "in_progress", "revision"]).lt("deadline", now).order("deadline").limit(8),
    db.from("expert_profiles").select("user_id", { count: "exact", head: true }).eq("status", "approved"),
    db.from("users").select("id", { count: "exact", head: true }).eq("role", "client"),
  ]);
  const all = orders.data ?? [];
  const released = all.filter((o) => o.escrow_status === "released");
  const gmv = released.reduce((s, o) => s + o.amount - (o.refund_amount ?? 0), 0);
  const revenue = released.reduce((s, o) => s + o.fee_amount, 0);
  const held = all.filter((o) => o.escrow_status === "held").reduce((s, o) => s + o.amount, 0);
  const payoutTotal = (payouts.data ?? []).reduce((s, p) => s + p.amount, 0);
  const byStatus = (tasks.data ?? []).reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader
        title="Overview"
        description="Everything happening on ZeroAI Hub, and what needs your attention."
        action={<LinkButton href="/admin/experts" variant="secondary">Add an expert</LinkButton>}
      />
      {disputes.count || payouts.data?.length || invited.count ? (
        <div className="mb-6 space-y-2">
          {!!disputes.count && <Notice tone="danger"><Link className="font-semibold underline" href="/admin/disputes">{disputes.count} open dispute(s)</Link> need a decision.</Notice>}
          {!!payouts.data?.length && <Notice tone="amber"><Link className="font-semibold underline" href="/admin/payouts">{payouts.data.length} withdrawal(s)</Link> totalling {formatMoney(payoutTotal)} to send.</Notice>}
          {!!invited.count && <Notice tone="info"><Link className="font-semibold underline" href="/admin/experts?tab=invited">{invited.count} expert(s)</Link> haven&apos;t logged in yet.</Notice>}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Completed order value" value={formatMoney(gmv)} />
        <Stat label="Platform fees earned" value={formatMoney(revenue)} />
        <Stat label="Held in escrow" value={formatMoney(held)} />
        <Stat label="Clients and experts" value={`${clients.count ?? 0} / ${experts.count ?? 0}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={<span className="flex items-center gap-2"><UserSearch size={18} className="text-seal" aria-hidden /> Waiting for an expert</span>} description="Open tasks, oldest first. Open one to assign an expert." />
          <TaskRows tasks={(unassigned.data ?? []) as Task[]} empty="Every open task has been matched." meta={(t) => `Posted ${formatDate(t.published_at ?? t.created_at)}, due ${formatDate(t.deadline)}`} />
        </Panel>
        <Panel>
          <PanelHeader title={<span className="flex items-center gap-2"><AlarmClock size={18} className="text-danger" aria-hidden /> Past their deadline</span>} description="Paid tasks that haven't been delivered on time." />
          <TaskRows tasks={(overdue.data ?? []) as Task[]} empty="Nothing is late. Every paid task is on schedule." meta={(t) => `Was due ${formatDate(t.deadline, true)}`} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <Panel className="self-start">
          <PanelHeader title="Tasks by status" />
          <ul className="divide-y divide-thread text-sm">
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
              <li key={s}>
                <Link href={`/admin/tasks?status=${s}`} className="flex justify-between px-5 py-2.5 hover:bg-paper">
                  <span>{STATUS_LABEL[s]}</span>
                  <span className="num font-semibold">{byStatus[s] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Recent activity" />
          <TaskRows tasks={(recent.data ?? []) as Task[]} empty="No tasks yet." meta={(t) => `Updated ${formatDate(t.updated_at, true)}`} />
        </Panel>
      </div>
    </>
  );
}
