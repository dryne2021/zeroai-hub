import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, FileCheck, Lock, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { runAutoAccept } from "@/lib/lifecycle";
import { Badge, Container, Notice, Panel, PanelHeader, Stars, StatusBadge } from "@/components/ui";
import { HumanMadeBadge, HumanMadeSeal } from "@/components/seal";
import { QuotesList, type QuoteWithExpert } from "@/components/task/quotes-list";
import { ChatPanel, type Thread } from "@/components/task/chat-panel";
import { BriefFiles, ReportFiles, WorkFiles, type Viewer } from "@/components/task/file-list";
import { ClientReviewActions, DisputeForm, ExpertUpload, PublishControls, QuoteForm, RatingForm, ReportUpload } from "@/components/task/actions";
import { AdminTaskTools } from "@/components/admin/task-tools";
import { ESCROW_LABEL, STATUS_LABEL, displayName, formatDate, formatMoney } from "@/lib/format";
import type { Dispute, Message, Order, PublicProfile, Quote, Review, Task, TaskFile, TaskStatus } from "@/lib/types";
import { adminPath } from "@/lib/admin-path";

export const metadata: Metadata = { title: "Task" };

const STEPS: { key: TaskStatus[]; label: string }[] = [
  { key: ["draft", "open"], label: "Posted" },
  { key: ["quoted"], label: "Quoted" },
  { key: ["funded"], label: "Funded" },
  { key: ["in_progress", "revision"], label: "In progress" },
  { key: ["delivered"], label: "Delivered" },
  { key: ["completed"], label: "Completed" },
];

function stepIndex(status: TaskStatus) {
  return STEPS.findIndex((s) => s.key.includes(status));
}

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ thread?: string; payment?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/tasks/${id}`);
  const supabase = await createClient();

  let { data: taskRow } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!taskRow) notFound();
  // Lazy auto-accept, in addition to the daily cron
  if (taskRow.status === "delivered" && (await runAutoAccept(id)) > 0) {
    taskRow = (await supabase.from("tasks").select("*").eq("id", id).single()).data;
  }
  const task = taskRow as Task;

  const isClient = task.client_id === user.id;
  const isHired = task.expert_id === user.id;
  const isAdmin = user.profile.role === "admin";
  const isExpertViewer = user.profile.role === "expert" && !isHired;

  const [settings, catRes, quotesRes, orderRes, filesRes, disputeRes, reviewsRes] = await Promise.all([
    getSettings(),
    supabase.from("categories").select("name").eq("id", task.category_id).single(),
    supabase.from("quotes").select("*").eq("task_id", id).order("created_at"),
    supabase.from("orders").select("*").eq("task_id", id).maybeSingle(),
    supabase.from("task_files").select("*").eq("task_id", id).order("created_at"),
    supabase.from("disputes").select("*").eq("task_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("reviews").select("*").eq("task_id", id),
  ]);
  const quotes = (quotesRes.data ?? []) as Quote[];
  const order = orderRes.data as Order | null;
  const files = (filesRes.data ?? []) as TaskFile[];
  const dispute = disputeRes.data as Dispute | null;
  const reviews = (reviewsRes.data ?? []) as Review[];

  // Conversation threads (one per expert talking to this client)
  const { data: threadRows } = await supabase.from("messages").select("expert_id, sender_id, read_at").eq("task_id", id);
  const threadIds = new Set<string>();
  if (isClient || isAdmin) {
    quotes.forEach((q) => threadIds.add(q.expert_id));
    (threadRows ?? []).forEach((m) => threadIds.add(m.expert_id));
    if (task.expert_id) threadIds.add(task.expert_id);
  } else if (user.profile.role === "expert") threadIds.add(user.id);

  const peopleIds = Array.from(new Set([task.client_id, ...threadIds, ...reviews.map((r) => r.reviewer_id)]));
  const { data: people } = await supabase.from("public_profiles").select("*").in("id", peopleIds);
  const profile = (uid: string | null) => (people as PublicProfile[] | null)?.find((p) => p.id === uid) ?? null;
  const nameOf = (uid: string | null) => displayName(profile(uid)?.full_name, uid === task.client_id ? "Client" : "Expert");

  const orderedThreads = Array.from(threadIds).sort((a, b) => (a === task.expert_id ? -1 : b === task.expert_id ? 1 : 0));
  const threads: Thread[] = orderedThreads.map((eid) => ({
    expertId: eid,
    name: nameOf(eid),
    unread: (threadRows ?? []).filter((m) => m.expert_id === eid && m.sender_id !== user.id && !m.read_at).length,
  }));
  const activeThread = sp.thread && threadIds.has(sp.thread) ? sp.thread : (orderedThreads[0] ?? null);
  const { data: initialMessages } = activeThread
    ? await supabase.from("messages").select("*").eq("task_id", id).eq("expert_id", activeThread).order("created_at").limit(500)
    : { data: [] };
  const names: Record<string, string> = Object.fromEntries(peopleIds.map((p) => [p, nameOf(p)]));
  if (isAdmin) names[user.id] = "ZeroAI Hub team";

  const myQuote = quotes.find((q) => q.expert_id === user.id) ?? null;

  // Experts an admin can assign: active ones, those in this task's category listed first.
  let assignable: { id: string; name: string; inCategory: boolean; onboarded: boolean }[] = [];
  if (isAdmin) {
    const db = createAdminClient();
    const { data: eps } = await db.from("expert_profiles").select("user_id, category_ids, onboarded_at, users!expert_profiles_user_id_fkey(full_name, is_banned)").eq("status", "approved");
    assignable = ((eps ?? []) as unknown as { user_id: string; category_ids: string[]; onboarded_at: string | null; users: { full_name: string | null; is_banned: boolean } | null }[])
      .filter((e) => !e.users?.is_banned)
      .map((e) => ({ id: e.user_id, name: e.users?.full_name || "Expert", inCategory: e.category_ids.includes(task.category_id), onboarded: Boolean(e.onboarded_at) }))
      .sort((a, b) => Number(b.inCategory) - Number(a.inCategory) || a.name.localeCompare(b.name));
  }
  const quotesWithExperts: QuoteWithExpert[] = quotes.map((q) => ({ ...q, expert: profile(q.expert_id) }));
  const hasDraft = files.some((f) => f.kind === "draft");
  const finalUnlocked = order?.escrow_status === "released" && task.status === "completed";
  const viewer: Viewer = isAdmin ? "admin" : isClient ? "client" : isHired ? "expert" : "candidate";
  const canParticipate = isClient || isHired || (isExpertViewer && ["open", "quoted"].includes(task.status)) || (isExpertViewer && Boolean(myQuote));
  const chatOpen = canParticipate && !["cancelled"].includes(task.status) && (isClient || isHired || ["open", "quoted"].includes(task.status));
  const contactUnlocked = Boolean(task.expert_id) && !["draft", "open", "quoted"].includes(task.status);
  const autoAcceptOn = task.delivered_at ? formatDate(new Date(new Date(task.delivered_at).getTime() + settings.auto_accept_days * 86400_000), true) : "";
  const myReview = reviews.find((r) => r.reviewer_id === user.id);
  const currentStep = stepIndex(task.status);
  const otherParty = isClient ? task.expert_id : task.client_id;

  return (
    <Container className="py-6 sm:py-10">
      <Link href={isAdmin ? adminPath("/tasks") : isClient ? "/client" : "/expert"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Back
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            {task.status === "completed" && !task.ai_confirmed && <HumanMadeBadge />}
            {task.ai_confirmed && <Badge tone="danger">AI use confirmed</Badge>}
            <span className="text-sm text-muted">{catRes.data?.name}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-[32px]">{task.title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>Posted by {nameOf(task.client_id)}</span>
            <span className="inline-flex items-center gap-1"><CalendarClock size={14} aria-hidden /> Due {formatDate(task.deadline, true)}</span>
            <span className="num font-semibold text-ink">{formatMoney(order ? order.amount : settings.task_price)} flat</span>
          </p>
        </div>
        {task.status === "completed" && !task.ai_confirmed && <HumanMadeSeal size={112} id="task-seal" className="hidden shrink-0 lg:block" />}
      </div>

      {/* Progress */}
      {!["cancelled", "disputed"].includes(task.status) && (
        <ol className="mt-6 grid grid-cols-6 gap-1" aria-label="Task progress">
          {STEPS.map((s, i) => (
            <li key={s.label} className="min-w-0">
              <span className={clsx("block h-1.5 rounded-full", i <= currentStep ? "bg-seal" : "bg-thread")} />
              <span className={clsx("mt-1.5 hidden truncate text-xs sm:block", i === currentStep ? "font-semibold text-ink" : "text-muted")}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      {sp.payment === "success" && order?.escrow_status === "held" && (
        <div className="mt-6"><Notice tone="seal">Payment received and held in escrow. Your expert has been notified.</Notice></div>
      )}
      {sp.payment === "failed" && order?.escrow_status === "pending" && (
        <div className="mt-6"><Notice tone="danger">The card payment didn&apos;t go through and you haven&apos;t been charged. Try again or use a different card.</Notice></div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {/* What happens next */}
          {isAdmin && (
            <AdminTaskTools
              taskId={task.id}
              status={task.status}
              aiConfirmed={task.ai_confirmed}
              currentExpertId={task.expert_id}
              experts={assignable}
              escrow={order?.escrow_status ?? null}
            />
          )}
          <NextStep />

          {/* Brief */}
          <Panel>
            <PanelHeader title="Brief" />
            <div className="px-5 py-4">
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{task.description}</p>
              <BriefFiles files={files} />
            </div>
          </Panel>

          {/* Work files */}
          {(isClient || isHired || isAdmin) && task.status !== "draft" && task.expert_id && (
            <Panel>
              <PanelHeader title="Drafts and deliveries" description="Every upload is kept with its timestamp." />
              <div className="px-5 py-5">
                <WorkFiles files={files} viewer={viewer} finalUnlocked={finalUnlocked} />
              </div>
            </Panel>
          )}

          {/* AI & plagiarism reports */}
          {(isClient || isHired || isAdmin) && task.expert_id && ["funded", "in_progress", "revision", "delivered", "completed", "disputed"].includes(task.status) && (
            <Panel className="border-seal/30">
              <PanelHeader
                title={<span className="flex items-center gap-2"><FileCheck size={19} className="text-seal" aria-hidden /> AI & plagiarism reports</span>}
                description={isClient ? "Proof your work is 100% human. Open any report at any time." : "Add the Turnitin AI report and the plagiarism report for the final work."}
              />
              <div className="space-y-5 px-5 py-5">
                {files.some((f) => f.kind === "report") ? (
                  <ReportFiles files={files} />
                ) : (
                  <p className="text-[15px] text-muted">
                    {isClient ? "Your Turnitin AI report and plagiarism report will appear here with the delivery." : "No reports added yet."}
                  </p>
                )}
                {(isHired || isAdmin) && !["cancelled"].includes(task.status) && <ReportUpload taskId={task.id} />}
              </div>
            </Panel>
          )}

          {/* Reviews */}
          {task.status === "completed" && reviews.length > 0 && (
            <Panel>
              <PanelHeader title="Ratings" />
              <ul className="divide-y divide-thread">
                {reviews.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{nameOf(r.reviewer_id)}</p>
                      <Stars value={r.rating} count={1} />
                    </div>
                    {r.comment && <p className="mt-1 text-[15px] text-muted">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {order && order.escrow_status !== "pending" && (isClient || isHired || isAdmin) && (
            <Panel className="px-5 py-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-seal" aria-hidden /> Escrow</p>
                <Badge tone={ESCROW_LABEL[order.escrow_status].tone}>{ESCROW_LABEL[order.escrow_status].label}</Badge>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd className="num font-semibold">{formatMoney(order.amount)}</dd></div>
                {(isHired || isAdmin) && (
                  <>
                    <div className="flex justify-between"><dt className="text-muted">Platform fee ({Number(order.fee_percent)}%)</dt><dd className="num">−{formatMoney(order.fee_amount)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Expert receives</dt><dd className="num font-semibold">{formatMoney(order.expert_amount)}</dd></div>
                  </>
                )}
                {order.refund_amount > 0 && <div className="flex justify-between text-amber"><dt>Refunded</dt><dd className="num">{formatMoney(order.refund_amount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted">Revisions used</dt><dd className="num">{task.revisions_used} of {task.revisions_included}</dd></div>
              </dl>
              {isClient && order.receipt_number && (
                <Link href={`/orders/${order.id}/receipt`} className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">View receipt</Link>
              )}
            </Panel>
          )}

          <Panel id="chat" className="scroll-mt-20 overflow-hidden">
            <PanelHeader
              title="Messages"
              description={
                contactUnlocked
                  ? `Chat with ${isClient ? nameOf(task.expert_id) : nameOf(task.client_id)}`
                  : "Contact details stay hidden until the task is funded."
              }
            />
            {canParticipate || isAdmin ? (
              <ChatPanel
                taskId={task.id}
                currentUserId={user.id}
                threads={threads}
                activeExpertId={activeThread}
                initialMessages={(initialMessages ?? []) as Message[]}
                names={names}
                contactUnlocked={contactUnlocked}
                canSend={isAdmin ? task.status !== "cancelled" : chatOpen}
              />
            ) : (
              <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted"><Lock size={15} aria-hidden /> Chat is open to the client and quoting experts.</p>
            )}
          </Panel>
        </aside>
      </div>
    </Container>
  );

  function NextStep() {
    // ---- Disputed / cancelled -------------------------------------------
    if (task.status === "disputed") {
      return (
        <Panel className="border-danger/30">
          <PanelHeader title="Dispute under review" description={dispute ? `Opened ${formatDate(dispute.created_at)}: ${dispute.reason}` : undefined} />
          <div className="px-5 py-4 text-[15px] text-muted">
            Payment stays in escrow while an admin reviews the brief, files and chat. Both of you will be notified of the decision. Keep talking in chat if you can resolve it.
          </div>
        </Panel>
      );
    }
    if (task.status === "cancelled") {
      return (
        <Notice tone="info">
          {task.ai_confirmed
            ? "This task was cancelled after an audit confirmed AI use. The client was refunded in full."
            : dispute?.resolution === "refund"
              ? `This task was cancelled and refunded. ${dispute.admin_note ?? ""}`
              : "This task was cancelled."}
        </Notice>
      );
    }

    // ---- Client ---------------------------------------------------------
    if (isClient) {
      if (task.status === "draft") {
        return (
          <Panel>
            <PanelHeader title="This task is a draft" description="Experts can't see it yet. Publish it to start receiving quotes." />
            <div className="px-5 py-4"><PublishControls taskId={task.id} isDraft /></div>
          </Panel>
        );
      }
      if (task.status === "open" || task.status === "quoted") {
        const pending = quotesWithExperts.filter((q) => q.status === "pending");
        return (
          <Panel>
            <PanelHeader
              title={pending.length ? `Experts ready to start (${pending.length})` : "Finding your expert"}
              description={pending.length ? `Every task is a flat ${formatMoney(settings.task_price)}. Compare delivery dates and ratings, then pay to get started.` : "Vetted experts in this category can see your task, and our team is matching you with one."}
            />
            <div className="space-y-5 px-5 py-5">
              {quotesWithExperts.length > 0 ? (
                <QuotesList taskId={task.id} quotes={quotesWithExperts} canPay />
              ) : (
                <p className="text-[15px] text-muted">You&apos;ll usually hear from an expert within a few hours. We&apos;ll notify you by email and here.</p>
              )}
              <div className="border-t border-thread pt-4"><PublishControls taskId={task.id} isDraft={false} /></div>
            </div>
          </Panel>
        );
      }
      if (["funded", "in_progress", "revision"].includes(task.status)) {
        return (
          <Panel>
            <PanelHeader
              title={task.status === "revision" ? "Revision in progress" : `${nameOf(task.expert_id)} is working on it`}
              description={`Your ${formatMoney(order?.amount)} is held in escrow. Drafts appear below as watermarked previews.`}
            />
            <div className="px-5 py-4"><DisputeForm taskId={task.id} /></div>
          </Panel>
        );
      }
      if (task.status === "delivered") {
        return (
          <Panel className="border-2 border-amber/40">
            <PanelHeader title="Work delivered: your review" description="Preview the final file below before you decide." />
            <div className="space-y-4 px-5 py-5">
              <ClientReviewActions taskId={task.id} revisionsLeft={task.revisions_included - task.revisions_used} autoAcceptOn={autoAcceptOn} />
              <DisputeForm taskId={task.id} />
            </div>
          </Panel>
        );
      }
      if (task.status === "completed") {
        const final = files.filter((f) => f.kind === "final").sort((a, b) => b.version - a.version)[0];
        return (
          <Panel className="border-seal/30">
            <PanelHeader title="Completed" description={task.auto_accepted ? "Accepted automatically after the review window ended." : `Completed on ${formatDate(task.completed_at)}.`} />
            <div className="space-y-5 px-5 py-5">
              {final && finalUnlocked && (
                <a href={`/api/files/${final.id}`} className="inline-flex h-12 items-center gap-2 rounded-control bg-seal px-5 font-semibold text-white hover:bg-seal-dark">
                  Download final file
                </a>
              )}
              <p className="text-xs text-muted">Download links are signed and expire after a few minutes. Come back here any time to get a fresh one.</p>
              {otherParty && !myReview ? <RatingForm taskId={task.id} otherName={nameOf(otherParty)} /> : myReview && <p className="text-sm text-muted">You rated this task {myReview.rating} out of 5.</p>}
            </div>
          </Panel>
        );
      }
    }

    // ---- Hired expert --------------------------------------------------
    if (isHired) {
      if (["funded", "in_progress", "revision"].includes(task.status)) {
        return (
          <Panel>
            <PanelHeader
              title={hasDraft ? "Keep going" : "Start with a draft"}
              description={`Payment of ${formatMoney(order?.amount)} is held in escrow. You must upload at least one draft before delivering the final file.`}
            />
            <div className="space-y-4 px-5 py-5">
              <ExpertUpload taskId={task.id} hasDraft={hasDraft} status={task.status} />
              <DisputeForm taskId={task.id} />
            </div>
          </Panel>
        );
      }
      if (task.status === "delivered") {
        return (
          <Panel>
            <PanelHeader title="Delivered: waiting for the client" description={`If the client doesn't respond, it's accepted automatically on ${autoAcceptOn}.`} />
            <div className="px-5 py-4"><DisputeForm taskId={task.id} /></div>
          </Panel>
        );
      }
      if (task.status === "completed") {
        return (
          <Panel className="border-seal/30">
            <PanelHeader title={`${formatMoney(order?.expert_amount)} added to your earnings`} description="The client accepted your work." />
            <div className="px-5 py-5">
              {!myReview ? <RatingForm taskId={task.id} otherName={nameOf(task.client_id)} /> : <p className="text-sm text-muted">You rated this client {myReview.rating} out of 5.</p>}
            </div>
          </Panel>
        );
      }
    }

    // ---- Other experts --------------------------------------------------
    if (isExpertViewer && ["open", "quoted"].includes(task.status)) {
      return (
        <Panel>
          <PanelHeader title={myQuote && myQuote.status !== "withdrawn" ? "Your offer" : "Take on this task"} description="Ask questions in chat first if anything is unclear." />
          <div className="px-5 py-5"><QuoteForm taskId={task.id} existing={myQuote} price={settings.task_price} feePercent={settings.fee_percent} /></div>
        </Panel>
      );
    }
    if (isExpertViewer) {
      return <Notice tone="info">This task is {STATUS_LABEL[task.status].toLowerCase()} and no longer taking offers.</Notice>;
    }

    // ---- Admin ----------------------------------------------------------
    if (isAdmin) {
      return (
        <Panel>
          <PanelHeader title="Offers" description="Every offer, file and conversation on this task is visible to you." />
          <div className="px-5 py-5">
            {quotesWithExperts.length ? <QuotesList taskId={task.id} quotes={quotesWithExperts} canPay={false} /> : <p className="text-sm text-muted">No offers yet. Assign an expert below.</p>}
          </div>
        </Panel>
      );
    }
    return null;
  }
}
