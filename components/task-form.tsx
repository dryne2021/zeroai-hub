"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createTask, publishTask } from "@/app/actions/tasks";
import { uploadTaskFile } from "@/lib/upload";
import { FileDrop } from "@/components/file-drop";
import { Button, Notice } from "@/components/ui";
import type { Category } from "@/lib/types";
import { BadgeDollarSign } from "lucide-react";
import { formatMoney } from "@/lib/format";

function defaultDeadline() {
  const d = new Date(Date.now() + 3 * 86400_000);
  d.setHours(17, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskForm({ categories, initialCategory, price }: { categories: Category[]; initialCategory?: string; price: number }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<false | "draft" | "publish">(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "draft" ? "draft" : "publish";
    const f = new FormData(e.currentTarget);
    setError(null);
    setBusy(intent);
    try {
      const res = await createTask({
        title: String(f.get("title") || ""),
        category_id: String(f.get("category_id") || ""),
        description: String(f.get("description") || ""),
        deadline: new Date(String(f.get("deadline") || "")).toISOString(),
      });
      if (!res.ok || !res.taskId) throw new Error(res.ok ? "Could not save the task." : res.error);
      for (const file of files) {
        await uploadTaskFile(file, {
          taskId: res.taskId,
          kind: "brief",
          onProgress: (pct) => setProgress((p) => ({ ...p, [file.name]: pct })),
        });
      }
      if (intent === "publish") {
        const pub = await publishTask(res.taskId);
        if (!pub.ok) throw new Error(pub.error);
        toast.success("Task posted. Experts can now send quotes.");
      } else toast.success("Saved as a draft.");
      router.push(`/tasks/${res.taskId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="label" htmlFor="title">Task title</label>
        <input id="title" name="title" required minLength={5} maxLength={140} placeholder="e.g. Proofread a 12-page business proposal" className="input" />
      </div>

      <div>
        <label className="label" htmlFor="category_id">Category</label>
        <select id="category_id" name="category_id" required defaultValue={categories.find((c) => c.slug === initialCategory)?.id ?? ""} className="input">
          <option value="" disabled>Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="description">What do you need?</label>
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={8000}
          rows={7}
          className="input leading-relaxed"
          placeholder="Explain the goal, who it's for, the format you want back, and anything the expert must follow."
        />
        <p className="hint">Don&apos;t include phone numbers or emails. Contact details are hidden in chat until you hire someone.</p>
      </div>

      <div>
        <span className="label">Attachments (optional)</span>
        <FileDrop files={files} onChange={setFiles} progress={busy ? progress : undefined} hint="Up to 100 MB per file, 10 files." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="deadline">Deadline</label>
          <input id="deadline" name="deadline" type="datetime-local" required defaultValue={defaultDeadline()} className="input" />
          <p className="hint">Your expert commits to delivering by this date.</p>
        </div>
        <div className="flex items-start gap-3 rounded-control border border-seal/30 bg-seal-faint/60 p-4">
          <BadgeDollarSign size={22} className="mt-0.5 shrink-0 text-seal" aria-hidden />
          <div>
            <p className="font-semibold"><span className="num">{formatMoney(price)}</span> flat price</p>
            <p className="text-sm text-muted">You pay only when you accept an expert. Held in escrow until you approve the work.</p>
          </div>
        </div>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="flex flex-col-reverse gap-3 border-t border-thread pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" name="intent" value="draft" variant="secondary" disabled={Boolean(busy)}>
          {busy === "draft" ? "Saving…" : "Save as draft"}
        </Button>
        <Button type="submit" name="intent" value="publish" disabled={Boolean(busy)}>
          {busy === "publish" ? (files.length ? "Uploading files…" : "Posting…") : "Post task"}
        </Button>
      </div>
    </form>
  );
}
