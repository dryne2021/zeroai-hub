import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { ResolveDisputeForm } from "@/components/admin/forms";
import { displayName, formatDate, formatMoney } from "@/lib/format";
import type { Dispute } from "@/lib/types";

export const metadata: Metadata = { title: "Disputes" };

type Row = Dispute & { tasks: { title: string; client_id: string; expert_id: string } | null; orders: { amount: number } | null };

export default async function DisputesPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db.from("disputes").select("*, tasks(title, client_id, expert_id), orders(amount)").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as Row[];
  const ids = Array.from(new Set(rows.flatMap((d) => [d.opened_by, d.tasks?.client_id, d.tasks?.expert_id]).filter(Boolean))) as string[];
  const { data: people } = ids.length ? await db.from("users").select("id, full_name, email").in("id", ids) : { data: [] };
  const name = (id?: string | null) => displayName(people?.find((p) => p.id === id)?.full_name, "Member");
  const open = rows.filter((d) => d.status === "open");
  const resolved = rows.filter((d) => d.status === "resolved");

  return (
    <>
      <PageHeader title="Disputes" description="Read the task's chat and files before deciding. The decision is final and notifies both parties." />
      {open.length === 0 ? (
        <EmptyState title="No open disputes" />
      ) : (
        <div className="space-y-4">
          {open.map((d) => (
            <article key={d.id} className="panel p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={`/tasks/${d.task_id}`} className="text-lg font-semibold hover:underline">{d.tasks?.title}</Link>
                  <p className="text-sm text-muted">
                    Opened by {name(d.opened_by)} ({d.opened_by === d.tasks?.client_id ? "client" : "expert"}) on {formatDate(d.created_at, true)}. Client: {name(d.tasks?.client_id)}. Expert: {name(d.tasks?.expert_id)}.
                  </p>
                </div>
                <span className="num font-display text-xl font-bold">{formatMoney(d.orders?.amount)}</span>
              </div>
              <div className="mt-3 rounded-control bg-paper p-3 text-[15px]">
                <p className="font-semibold">{d.reason}</p>
                {d.details && <p className="mt-1 whitespace-pre-line text-muted">{d.details}</p>}
              </div>
              <p className="mt-3 text-sm"><Link href={`/tasks/${d.task_id}`} className="font-semibold underline">Open the task room</Link> to review files and every message.</p>
              <div className="mt-4 border-t border-thread pt-4">
                <ResolveDisputeForm disputeId={d.id} amount={d.orders?.amount ?? 0} />
              </div>
            </article>
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <Panel className="mt-8">
          <PanelHeader title="Resolved" />
          <ul className="divide-y divide-thread">
            {resolved.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/tasks/${d.task_id}`} className="block truncate font-medium hover:underline">{d.tasks?.title}</Link>
                  <p className="truncate text-muted">{formatDate(d.resolved_at)}: {d.admin_note}</p>
                </div>
                <Badge tone={d.resolution === "release" ? "seal" : "amber"}>
                  {d.resolution === "release" ? "Released" : d.resolution === "refund" ? "Refunded" : `Partial ${formatMoney(d.refund_amount)}`}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
