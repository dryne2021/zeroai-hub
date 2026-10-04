import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedExpert } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/settings";
import { Badge, Container, EmptyState, LinkButton, Notice, PageHeader, Panel, PanelHeader, Stars, Stat } from "@/components/ui";
import { TaskCard } from "@/components/task-card";
import { formatDate, formatMoney } from "@/lib/format";
import type { Quote, Task } from "@/lib/types";

export const metadata: Metadata = { title: "My work" };

export default async function ExpertHome() {
  const { user, profile } = await requireOnboardedExpert("/expert");

  if (!profile || profile.status !== "approved") {
    return (
      <Container className="max-w-2xl py-12">
        <PageHeader title="Your expert account" />
        <Notice tone={profile?.status === "suspended" ? "danger" : "info"}>
          <p className="font-semibold">{profile?.status === "suspended" ? "Account suspended" : "Account not active"}</p>
          <p>{profile?.review_note || "Your expert account isn't active right now."} Contact the ZeroAI Hub team for help, and reach out about any remaining balance.</p>
        </Notice>
      </Container>
    );
  }

  const supabase = await createClient();
  const [{ data: jobs }, { data: quotes }, { data: earnings }, categories] = await Promise.all([
    supabase.from("tasks").select("*").eq("expert_id", user.id).order("updated_at", { ascending: false }).limit(50),
    supabase.from("quotes").select("*, tasks(*)").eq("expert_id", user.id).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("expert_earnings").select("*").eq("expert_id", user.id).maybeSingle(),
    getCategories(true),
  ]);
  const all = (jobs ?? []) as Task[];
  const active = all.filter((t) => ["funded", "in_progress", "revision", "delivered", "disputed"].includes(t.status));
  const done = all.filter((t) => t.status === "completed").slice(0, 6);
  const pendingQuotes = (quotes ?? []) as (Quote & { tasks: Task })[];
  const cat = (id: string) => categories.find((c) => c.id === id)?.name;
  const available = earnings ? earnings.earned - earnings.paid_out - earnings.pending_payouts : 0;

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        title={`Welcome back, ${user.profile.full_name?.split(" ")[0] ?? "expert"}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {profile.headline} <Stars value={profile.rating_avg} count={profile.rating_count} />
          </span>
        }
        action={<LinkButton href="/expert/browse">Find tasks</LinkButton>}
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Available to withdraw" value={formatMoney(available)} hint={<Link href="/expert/earnings" className="underline">Withdraw</Link>} />
        <Stat label="In escrow" value={formatMoney(earnings?.in_escrow ?? 0)} hint="Released when clients accept" />
        <Stat label="Active jobs" value={active.length} />
        <Stat label="Open offers" value={pendingQuotes.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-xl font-bold">Active jobs</h2>
          {active.length ? (
            <div className="grid gap-3">
              {active.map((t) => (
                <TaskCard key={t.id} task={t} categoryName={cat(t.category_id)} />
              ))}
            </div>
          ) : (
            <EmptyState title="No active jobs" body="When a client accepts your application, or the ZeroAI Hub team assigns you a task, it shows up here." action={<LinkButton href="/expert/browse" variant="secondary">Browse open tasks</LinkButton>} />
          )}
          {done.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-xl font-bold">Recently completed</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {done.map((t) => <TaskCard key={t.id} task={t} categoryName={cat(t.category_id)} />)}
              </div>
            </>
          )}
        </section>
        <Panel className="self-start">
          <PanelHeader title="Offers awaiting the client" />
          {pendingQuotes.length ? (
            <ul className="divide-y divide-thread">
              {pendingQuotes.map((q) => (
                <li key={q.id}>
                  <Link href={`/tasks/${q.task_id}`} className="block px-5 py-3 hover:bg-paper">
                    <p className="truncate font-medium">{q.tasks?.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                      <span className="num font-semibold text-ink">{formatMoney(q.price)}</span> sent {formatDate(q.created_at)}
                      {q.tasks && !["open", "quoted"].includes(q.tasks.status) && <Badge>Closed</Badge>}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">No pending offers.</p>
          )}
        </Panel>
      </div>
    </Container>
  );
}
