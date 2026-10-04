import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { Badge, EmptyState, LinkButton, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { AuditButtons } from "@/components/admin/task-tools";
import { formatDate } from "@/lib/format";
import { adminPath } from "@/lib/admin-path";

export const metadata: Metadata = { title: "AI audits" };
export const dynamic = "force-dynamic";

function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function AuditsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: completed }, { data: audits }] = await Promise.all([
    db.from("tasks").select("id, title, completed_at, expert_id, categories(name)").eq("status", "completed").eq("ai_confirmed", false).order("completed_at", { ascending: false }).limit(1000),
    db.from("ai_audits").select("*, tasks(title)").order("created_at", { ascending: false }).limit(30),
  ]);
  const audited = new Set((audits ?? []).map((a) => a.task_id));
  const sample = shuffle((completed ?? []).filter((t) => !audited.has(t.id))).slice(0, 8);
  const { data: draftCounts } = sample.length
    ? await db.from("task_files").select("task_id, kind").in("task_id", sample.map((t) => t.id))
    : { data: [] };

  return (
    <>
      <PageHeader
        title="AI spot audits"
        description="A fresh random sample of completed tasks that haven't been audited. Open each one, compare the drafts with the final file and read the chat."
        action={<LinkButton href={adminPath("/audits")} variant="secondary">Draw a new sample</LinkButton>}
      />
      {sample.length === 0 ? (
        <EmptyState title="Nothing to audit" body="Completed tasks that haven't been audited yet will be sampled here." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {sample.map((t) => {
            const drafts = (draftCounts ?? []).filter((f) => f.task_id === t.id && f.kind === "draft").length;
            return (
              <li key={t.id} className="panel space-y-3 p-5">
                <div>
                  <Link href={`/tasks/${t.id}`} className="font-semibold hover:underline">{t.title}</Link>
                  <p className="text-sm text-muted">
                    {(t.categories as unknown as { name: string } | null)?.name}, completed {formatDate(t.completed_at)}, {drafts} draft{drafts === 1 ? "" : "s"}
                  </p>
                </div>
                <AuditButtons taskId={t.id} compact />
              </li>
            );
          })}
        </ul>
      )}
      <Panel className="mt-8">
        <PanelHeader title="Audit log" />
        {audits?.length ? (
          <ul className="divide-y divide-thread">
            {audits.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/tasks/${a.task_id}`} className="block truncate font-medium hover:underline">{(a.tasks as { title: string } | null)?.title}</Link>
                  <p className="text-muted">{formatDate(a.created_at, true)}{a.note ? `. ${a.note}` : ""}</p>
                </div>
                <Badge tone={a.outcome === "clear" ? "seal" : "danger"}>{a.outcome === "clear" ? "Human-made" : "AI confirmed"}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">No audits recorded yet.</p>
        )}
      </Panel>
    </>
  );
}
