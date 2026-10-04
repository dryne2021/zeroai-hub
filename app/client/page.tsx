import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import clsx from "clsx";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getSettings } from "@/lib/settings";
import { Container, EmptyState, LinkButton, PageHeader, Stat } from "@/components/ui";
import { TaskCard } from "@/components/task-card";
import { formatMoney } from "@/lib/format";
import type { Task } from "@/lib/types";

export const metadata: Metadata = { title: "My tasks" };

const FILTERS = [
  { key: "active", label: "Active", statuses: ["draft", "open", "quoted", "funded", "in_progress", "delivered", "revision", "disputed"] },
  { key: "review", label: "Needs your review", statuses: ["delivered"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "all", label: "All", statuses: [] as string[] },
];

export default async function ClientDashboard({ searchParams }: { searchParams: Promise<{ filter?: string; payment?: string }> }) {
  const user = await requireRole("client", "/client");
  const { filter = "active" } = await searchParams;
  const supabase = await createClient();
  const [{ data: tasks }, { data: quotes }, { data: orders }, categories, settings] = await Promise.all([
    supabase.from("tasks").select("*").eq("client_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("quotes").select("task_id, status").eq("status", "pending"),
    supabase.from("orders").select("amount, escrow_status").eq("client_id", user.id),
    getCategories(true),
    getSettings(),
  ]);
  const all = (tasks ?? []) as Task[];
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = active.statuses.length ? all.filter((t) => active.statuses.includes(t.status)) : all;
  const quoteCount = (id: string) => (quotes ?? []).filter((q) => q.task_id === id).length;
  const catName = (id: string) => categories.find((c) => c.id === id)?.name;
  const inEscrow = (orders ?? []).filter((o) => o.escrow_status === "held").reduce((s, o) => s + o.amount, 0);
  const awaitingReview = all.filter((t) => t.status === "delivered").length;

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        title={`Hi ${user.profile.full_name?.split(" ")[0] || "there"}`}
        description="Track your tasks, choose your expert and review deliveries."
        action={<LinkButton href="/tasks/new">Post a task</LinkButton>}
      />
      <div className="mb-6 flex flex-col gap-3 rounded-panel border border-seal/30 bg-seal-faint/60 p-5 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-seal">
          <FileCheck size={22} aria-hidden />
        </span>
        <div className="flex-1">
          <p className="font-semibold">Zero AI, with the reports to prove it</p>
          <p className="text-[15px] text-muted">Every task is done by a person, never AI. Your work comes with a Turnitin AI report and a plagiarism report, attached to the task.</p>
        </div>
        <Link href="/#proof" className="text-sm font-semibold text-seal-dark underline underline-offset-4">See sample reports</Link>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active tasks" value={all.filter((t) => FILTERS[0].statuses.includes(t.status)).length} />
        <Stat label="Waiting for your review" value={awaitingReview} />
        <Stat label="Held in escrow" value={formatMoney(inEscrow)} />
        <Stat label="Completed" value={all.filter((t) => t.status === "completed").length} />
      </div>
      <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Filter tasks">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/client?filter=${f.key}`}
            className={clsx(
              "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold",
              f.key === active.key ? "border-ink bg-ink text-white" : "border-thread bg-white text-muted hover:text-ink",
            )}
          >
            {f.label}
            {f.key === "review" && awaitingReview > 0 && <span className="ml-1.5 rounded-full bg-amber px-1.5 text-xs text-white">{awaitingReview}</span>}
          </Link>
        ))}
      </nav>
      {shown.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((t) => (
            <TaskCard key={t.id} task={t} price={settings.task_price} categoryName={catName(t.category_id)} quoteCount={["open", "quoted"].includes(t.status) ? quoteCount(t.id) : undefined} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={all.length ? "Nothing here right now" : "Post your first task"}
          body={all.length ? "Tasks matching this filter will show up here." : `Describe what you need and we'll match you with a vetted expert, usually within a few hours. Every task is a flat ${formatMoney(settings.task_price)}.`}
          action={<LinkButton href="/tasks/new">Post a task</LinkButton>}
        />
      )}
    </Container>
  );
}
