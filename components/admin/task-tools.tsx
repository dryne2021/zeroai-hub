"use client";

import { useState } from "react";
import { useAction } from "@/components/use-action";
import { Button, Notice, Panel, PanelHeader } from "@/components/ui";
import { adminCancelTask, adminReleasePayment, assignExpert, recordAudit } from "@/app/actions/admin";
import type { EscrowStatus, TaskStatus } from "@/lib/types";

export function AuditButtons({ taskId, compact = false }: { taskId: string; compact?: boolean }) {
  const { run, pending } = useAction();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");

  if (confirming) {
    return (
      <div className="space-y-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input" placeholder="Evidence: which file, what you found, any detector or interview notes." />
        <Notice tone="danger">This refunds the client in full, cancels the task and suspends the expert.</Notice>
        <div className="flex gap-2">
          <Button variant="danger" disabled={pending || note.trim().length < 10} onClick={() => run(() => recordAudit(taskId, "ai_confirmed", note), () => setConfirming(false))}>
            Confirm AI use
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Back</Button>
        </div>
      </div>
    );
  }
  return (
    <div className={compact ? "flex gap-2" : "flex flex-col gap-2 sm:flex-row"}>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => recordAudit(taskId, "clear", ""))}>
        Mark human-made
      </Button>
      <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
        AI use confirmed
      </Button>
    </div>
  );
}

type Assignable = { id: string; name: string; inCategory: boolean; onboarded: boolean };

function AssignExpert({ taskId, experts, currentExpertId, afterPayment }: { taskId: string; experts: Assignable[]; currentExpertId: string | null; afterPayment: boolean }) {
  const { run, pending } = useAction();
  const options = experts.filter((e) => e.id !== currentExpertId);
  const [expertId, setExpertId] = useState(options[0]?.id ?? "");
  const [note, setNote] = useState("");
  if (!options.length) return <p className="text-sm text-muted">No other active experts yet. Create one on the Experts page.</p>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <select value={expertId} onChange={(e) => setExpertId(e.target.value)} className="input" aria-label="Expert">
          {options.some((e) => e.inCategory) && (
            <optgroup label="In this category">
              {options.filter((e) => e.inCategory).map((e) => (
                <option key={e.id} value={e.id}>{e.name}{e.onboarded ? "" : " (hasn't logged in yet)"}</option>
              ))}
            </optgroup>
          )}
          {options.some((e) => !e.inCategory) && (
            <optgroup label="Other experts">
              {options.filter((e) => !e.inCategory).map((e) => (
                <option key={e.id} value={e.id}>{e.name}{e.onboarded ? "" : " (hasn't logged in yet)"}</option>
              ))}
            </optgroup>
          )}
        </select>
        <Button disabled={pending || !expertId} onClick={() => run(() => assignExpert(taskId, expertId, note), () => setNote(""))}>
          {afterPayment ? "Reassign" : "Assign expert"}
        </Button>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="input" placeholder="Optional note to the client and expert" />
      <p className="text-xs text-muted">
        {afterPayment
          ? "The task, its chat and the escrowed payment move to the new expert. Everyone is notified."
          : "Other offers are declined, and the client is asked to pay the flat price to start."}
      </p>
    </div>
  );
}

function Override({ taskId, escrow, status }: { taskId: string; escrow: EscrowStatus | null; status: TaskStatus }) {
  const { run, pending } = useAction();
  const [mode, setMode] = useState<null | "release" | "cancel">(null);
  const [note, setNote] = useState("");
  const canRelease = escrow === "held" && ["funded", "in_progress", "delivered", "revision"].includes(status);
  const canCancel = !["completed", "cancelled", "disputed"].includes(status) && escrow !== "released";
  if (!canRelease && !canCancel) return <p className="text-sm text-muted">No payment actions available for this task.</p>;

  if (mode) {
    return (
      <div className="space-y-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input" placeholder="Reason (both parties will see it)" />
        <Notice tone={mode === "release" ? "amber" : "danger"}>
          {mode === "release" ? "Completes the task and pays the expert from escrow. The client's final file unlocks." : escrow === "held" ? "Cancels the task and refunds the client in full." : "Cancels the task. Nothing has been paid."}
        </Notice>
        <div className="flex gap-2">
          <Button
            variant={mode === "release" ? "seal" : "danger"}
            disabled={pending || note.trim().length < 5}
            onClick={() => run(() => (mode === "release" ? adminReleasePayment(taskId, note) : adminCancelTask(taskId, note)), () => setMode(null))}
          >
            {mode === "release" ? "Release payment" : escrow === "held" ? "Cancel and refund" : "Cancel task"}
          </Button>
          <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {canRelease && <Button size="sm" variant="secondary" onClick={() => setMode("release")}>Release payment to expert</Button>}
      {canCancel && <Button size="sm" variant="danger" onClick={() => setMode("cancel")}>{escrow === "held" ? "Cancel and refund client" : "Cancel task"}</Button>}
    </div>
  );
}

export function AdminTaskTools({
  taskId,
  status,
  aiConfirmed,
  currentExpertId,
  experts,
  escrow,
}: {
  taskId: string;
  status: TaskStatus;
  aiConfirmed: boolean;
  currentExpertId: string | null;
  experts: Assignable[];
  escrow: EscrowStatus | null;
}) {
  const canAssign = ["draft", "open", "quoted", "funded", "in_progress", "revision", "disputed"].includes(status);
  const afterPayment = ["funded", "in_progress", "revision", "disputed"].includes(status);
  return (
    <Panel className="border-ink/20">
      <PanelHeader title="Admin controls" description="Assign experts, step in on payments and audit the work." />
      <div className="divide-y divide-thread">
        {canAssign && (
          <section className="px-5 py-5">
            <h3 className="mb-3 font-semibold">{afterPayment ? "Reassign to another expert" : "Assign an expert"}</h3>
            <AssignExpert taskId={taskId} experts={experts} currentExpertId={currentExpertId} afterPayment={afterPayment} />
          </section>
        )}
        <section className="px-5 py-5">
          <h3 className="mb-3 font-semibold">Payment</h3>
          <Override taskId={taskId} escrow={escrow} status={status} />
        </section>
        <section className="px-5 py-5">
          <h3 className="mb-3 font-semibold">AI audit</h3>
          {aiConfirmed ? (
            <Notice tone="danger">AI use has been confirmed on this task. The client was refunded and the expert suspended.</Notice>
          ) : ["completed", "delivered", "in_progress", "revision", "funded", "disputed"].includes(status) ? (
            <AuditButtons taskId={taskId} />
          ) : (
            <p className="text-sm text-muted">Audits are available once a task has been funded.</p>
          )}
        </section>
      </div>
    </Panel>
  );
}
