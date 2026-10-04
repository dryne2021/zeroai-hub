"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import clsx from "clsx";
import { useAction } from "@/components/use-action";
import { Button, Notice } from "@/components/ui";
import { FileDrop } from "@/components/file-drop";
import { submitQuote, withdrawQuote } from "@/app/actions/quotes";
import { acceptDelivery, cancelTask, publishTask, requestRevision } from "@/app/actions/tasks";
import { openDispute } from "@/app/actions/disputes";
import { submitReview } from "@/app/actions/reviews";
import { uploadTaskFile } from "@/lib/upload";
import { formatMoney } from "@/lib/format";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Quote } from "@/lib/types";

export function PublishControls({ taskId, isDraft }: { taskId: string; isDraft: boolean }) {
  const { run, pending } = useAction();
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {isDraft && (
        <Button onClick={() => run(() => publishTask(taskId))} disabled={pending}>
          Publish task
        </Button>
      )}
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (confirm("Cancel this task? Experts will no longer be able to quote.")) run(() => cancelTask(taskId));
        }}
      >
        Cancel task
      </Button>
    </div>
  );
}

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 2 * 86400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuoteForm({ taskId, existing, price, feePercent }: { taskId: string; existing: Quote | null; price: number; feePercent: number }) {
  const { run, pending, error } = useAction();
  const [editing, setEditing] = useState(!existing || existing.status === "withdrawn");
  const youGet = price - Math.round((price * feePercent) / 100);

  if (existing && !editing) {
    return (
      <div className="space-y-3">
        <Notice tone="seal">
          {existing.assigned_by_admin ? "The ZeroAI Hub team assigned this task to you." : "You offered to take this task."} You&apos;ll be notified as soon as the client pays into escrow.
        </Notice>
        {!existing.assigned_by_admin && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit offer</Button>
            <Button variant="ghost" disabled={pending} onClick={() => run(() => withdrawQuote(existing.id))}>Withdraw</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            submitQuote({
              taskId,
              delivery_date: new Date(String(f.get("delivery_date"))).toISOString(),
              note: String(f.get("note") || ""),
            }),
          () => setEditing(false),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-control border border-thread bg-paper/60 px-4 py-3">
          <p className="text-sm text-muted">Flat price</p>
          <p className="num font-display text-xl font-bold">{formatMoney(price)}</p>
          <p className="num text-xs text-muted">You receive {formatMoney(youGet)} after the {feePercent}% platform fee.</p>
        </div>
        <div>
          <label className="label" htmlFor="delivery_date">You&apos;ll deliver by</label>
          <input id="delivery_date" name="delivery_date" type="datetime-local" required defaultValue={toLocalInput(existing?.delivery_date)} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="note">Note to the client</label>
        <textarea id="note" name="note" rows={3} maxLength={1000} defaultValue={existing?.note} placeholder="How you'll approach it and what you need from them." className="input" />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : existing ? "Update offer" : "Offer to take this task"}</Button>
    </form>
  );
}

export function ClientReviewActions({ taskId, revisionsLeft, autoAcceptOn }: { taskId: string; revisionsLeft: number; autoAcceptOn: string }) {
  const { run, pending } = useAction();
  const [revising, setRevising] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-[15px] text-muted">
        Check the preview below. Accepting releases payment to the expert and unlocks the full file. If you don&apos;t respond, the work is accepted automatically on <strong className="text-ink">{autoAcceptOn}</strong>.
      </p>
      {revising ? (
        <div className="space-y-3">
          <label className="label" htmlFor="revision-note">What should the expert change?</label>
          <textarea id="revision-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Be specific: page, section, and what you expect instead." />
          <div className="flex gap-2">
            <Button disabled={pending || note.trim().length < 10} onClick={() => run(() => requestRevision(taskId, note), () => setRevising(false))}>
              Send revision request
            </Button>
            <Button variant="ghost" onClick={() => setRevising(false)}>Back</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="seal"
            disabled={pending}
            onClick={() => {
              if (confirm("Accept the work and release payment to the expert? This can't be undone.")) run(() => acceptDelivery(taskId));
            }}
          >
            Accept work and release payment
          </Button>
          <Button variant="secondary" disabled={revisionsLeft <= 0} onClick={() => setRevising(true)}>
            {revisionsLeft > 0 ? `Request a revision (${revisionsLeft} left)` : "No revisions left"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ExpertUpload({ taskId, hasDraft, status }: { taskId: string; hasDraft: boolean; status: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"draft" | "final">("draft");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!files[0]) return;
    if (kind === "final" && !confirm("Deliver this as the final file? The client will be asked to accept or request a revision.")) return;
    setBusy(true);
    try {
      await uploadTaskFile(files[0], { taskId, kind, note, onProgress: (p) => setProgress({ [files[0].name]: p }) });
      toast.success(kind === "final" ? "Final file delivered." : "Draft uploaded. The client can see a watermarked preview.");
      setFiles([]);
      setNote("");
      setProgress({});
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {status === "revision" && <Notice tone="amber">The client asked for a revision. Read their note in the chat, upload a new draft, then deliver the updated final file.</Notice>}
      <div role="radiogroup" aria-label="File type" className="grid grid-cols-2 gap-2">
        {(["draft", "final"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            disabled={k === "final" && !hasDraft}
            onClick={() => setKind(k)}
            className={clsx(
              "rounded-control border px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50",
              kind === k ? "border-ink bg-ink-faint ring-1 ring-ink" : "border-thread",
            )}
          >
            <span className="block text-[15px] font-semibold">{k === "draft" ? "Draft" : "Final delivery"}</span>
            <span className="block text-xs text-muted">{k === "draft" ? "Work in progress, shown as a preview" : hasDraft ? "Client reviews, then accepts" : "Upload a draft first"}</span>
          </button>
        ))}
      </div>
      <FileDrop files={files} onChange={setFiles} multiple={false} label="Choose a file" progress={busy ? progress : undefined} />
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional note, e.g. 'Sections 1 to 3 done'" className="input" />
      <Button onClick={upload} disabled={busy || !files.length} variant={kind === "final" ? "seal" : "primary"}>
        {busy ? "Uploading…" : kind === "final" ? "Deliver final file" : "Upload draft"}
      </Button>
    </div>
  );
}

const DISPUTE_REASONS = [
  "Work doesn't match the brief",
  "Missed the deadline",
  "Suspected AI use",
  "Expert or client unresponsive",
  "Other",
];

export function DisputeForm({ taskId }: { taskId: string }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-danger underline-offset-4 hover:underline">
        Open a dispute
      </button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-panel border border-danger/30 bg-danger-faint/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => openDispute(taskId, String(f.get("reason")), String(f.get("details") || "")), () => setOpen(false));
      }}
    >
      <p className="font-semibold">Open a dispute</p>
      <p className="text-sm text-muted">Payment stays in escrow. An admin reviews the chat and files, then decides on a refund, partial refund or release.</p>
      <select name="reason" required className="input" defaultValue="">
        <option value="" disabled>Choose a reason</option>
        {DISPUTE_REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <textarea name="details" rows={4} required minLength={20} className="input" placeholder="What happened? Include dates and what you expected." />
      <div className="flex gap-2">
        <Button variant="danger" type="submit" disabled={pending}>Submit dispute</Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function RatingForm({ taskId, otherName }: { taskId: string; otherName: string }) {
  const { run, pending } = useAction();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <div className="space-y-3">
      <p className="font-semibold">Rate your experience with {otherName}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className="rounded p-0.5"
          >
            <Star size={28} className={(hover || rating) >= n ? "fill-amber text-amber" : "text-thread"} />
          </button>
        ))}
      </div>
      <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className="input" placeholder="What went well? What could be better?" />
      <Button disabled={pending || rating === 0} onClick={() => run(() => submitReview(taskId, rating, comment))}>
        Submit rating
      </Button>
    </div>
  );
}

export function ReportUpload({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState("Turnitin AI report");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!files[0]) return;
    setBusy(true);
    try {
      await uploadTaskFile(files[0], { taskId, kind: "report", note: label, onProgress: (p) => setProgress({ [files[0].name]: p }) });
      toast.success("Report added. The client has been notified.");
      setFiles([]);
      setProgress({});
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Report type" className="flex flex-wrap gap-2">
        {["Turnitin AI report", "Plagiarism (similarity) report"].map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={label === l}
            onClick={() => setLabel(l)}
            className={clsx("rounded-full border px-3.5 py-1.5 text-sm font-semibold", label === l ? "border-ink bg-ink text-white" : "border-thread bg-white text-muted")}
          >
            {l}
          </button>
        ))}
      </div>
      <FileDrop files={files} onChange={setFiles} multiple={false} label="Choose the report (PDF)" progress={busy ? progress : undefined} />
      <Button onClick={upload} disabled={busy || !files.length} variant="seal">
        {busy ? "Uploading…" : `Add ${label.toLowerCase()}`}
      </Button>
    </div>
  );
}
