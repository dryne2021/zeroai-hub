import { Download, Eye, FileCheck, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/format";
import type { TaskFile } from "@/lib/types";

export type Viewer = "client" | "expert" | "admin" | "candidate";

/** Version history for drafts and finals, with the right link for each viewer. */
export function WorkFiles({ files, viewer, finalUnlocked }: { files: TaskFile[]; viewer: Viewer; finalUnlocked: boolean }) {
  const work = files.filter((f) => f.kind === "draft" || f.kind === "final").sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  if (!work.length) return <p className="text-[15px] text-muted">No drafts yet. Drafts and the final file appear here, newest first, with every version kept.</p>;

  return (
    <ol className="relative space-y-4 border-l-2 border-thread pl-5">
      {work.map((f) => {
        const isFinal = f.kind === "final";
        const clientCanDownload = viewer === "client" && isFinal && finalUnlocked;
        const canOriginal = viewer === "expert" || viewer === "admin" || clientCanDownload;
        const canPreview = (viewer === "client" || viewer === "admin") && f.preview_status === "ready";
        return (
          <li key={f.id} className="relative">
            <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${isFinal ? "bg-seal" : "bg-ink/40"}`} aria-hidden />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {isFinal ? `Final v${f.version}` : `Draft ${f.version}`}
                  {isFinal && <Badge tone="seal">Final</Badge>}
                </p>
                <p className="truncate text-sm text-muted">
                  {f.file_name}, {formatBytes(f.size_bytes)}, {formatDate(f.created_at, true)}
                </p>
                {f.note && <p className="mt-1 text-sm">{f.note}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {canPreview && (
                  <a href={`/api/files/${f.id}?variant=preview`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-thread px-3 text-sm font-semibold hover:border-ink/40">
                    <Eye size={15} aria-hidden /> Preview
                  </a>
                )}
                {canOriginal ? (
                  <a href={`/api/files/${f.id}`} className={`inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold ${clientCanDownload ? "bg-seal text-white hover:bg-seal-dark" : "border border-thread hover:border-ink/40"}`}>
                    <Download size={15} aria-hidden /> {clientCanDownload ? "Download final file" : "Original"}
                  </a>
                ) : (
                  viewer === "client" && (
                    <span className="inline-flex h-9 items-center gap-1.5 px-1 text-sm text-muted">
                      <Lock size={14} aria-hidden /> {isFinal ? "Unlocks when you accept" : "Preview only"}
                    </span>
                  )
                )}
              </div>
            </div>
            {viewer === "client" && f.preview_status === "unavailable" && (
              <p className="mt-1 text-xs text-muted">This file type can&apos;t be previewed. Ask the expert in chat for screenshots.</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function BriefFiles({ files }: { files: TaskFile[] }) {
  const briefs = files.filter((f) => f.kind === "brief");
  if (!briefs.length) return null;
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {briefs.map((f) => (
        <li key={f.id}>
          <a href={`/api/files/${f.id}`} className="flex items-center gap-3 rounded-control border border-thread bg-white px-3 py-2.5 text-sm hover:border-ink/40">
            <FileText size={18} className="shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">{f.file_name}</span>
            <span className="shrink-0 text-muted">{formatBytes(f.size_bytes)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** AI & plagiarism reports attached to a task. Both parties can open them at any time. */
export function ReportFiles({ files }: { files: TaskFile[] }) {
  const reports = files.filter((f) => f.kind === "report").sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  if (!reports.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {reports.map((f) => (
        <li key={f.id}>
          <a href={`/api/files/${f.id}`} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-control border border-seal/30 bg-seal-faint/50 px-3 py-3 text-sm hover:border-seal">
            <FileCheck size={20} className="shrink-0 text-seal" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{f.note || "AI & plagiarism report"}</span>
              <span className="block truncate text-muted">{f.file_name}, {formatDate(f.created_at)}</span>
            </span>
            <span className="shrink-0 font-semibold text-seal-dark">Open</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
