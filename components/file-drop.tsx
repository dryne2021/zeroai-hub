"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import clsx from "clsx";
import { formatBytes } from "@/lib/format";

export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export function FileDrop({
  files,
  onChange,
  multiple = true,
  label = "Add files",
  hint = "Up to 100 MB per file.",
  maxBytes = MAX_FILE_BYTES,
  progress,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  hint?: string;
  maxBytes?: number;
  progress?: Record<string, number>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const tooBig = incoming.filter((f) => f.size > maxBytes);
    setError(tooBig.length ? `${tooBig.map((f) => f.name).join(", ")} is larger than ${formatBytes(maxBytes)}.` : null);
    const ok = incoming.filter((f) => f.size <= maxBytes);
    onChange(multiple ? [...files, ...ok].slice(0, 10) : ok.slice(0, 1));
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={clsx(
          "flex flex-col items-center justify-center rounded-control border-2 border-dashed px-4 py-6 text-center transition-colors",
          over ? "border-seal bg-seal-faint" : "border-thread bg-paper/60",
        )}
      >
        <Paperclip size={20} className="text-muted" aria-hidden />
        <button type="button" onClick={() => input.current?.click()} className="mt-2 text-[15px] font-semibold text-ink underline underline-offset-4">
          {label}
        </button>
        <p className="mt-1 text-xs text-muted">or drag and drop. {hint}</p>
        <input ref={input} type="file" multiple={multiple} className="sr-only" onChange={(e) => add(e.target.files)} />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => {
            const pct = progress?.[f.name];
            return (
              <li key={`${f.name}-${i}`} className="relative overflow-hidden rounded-control border border-thread bg-white px-3 py-2 text-sm">
                {pct !== undefined && <span className="absolute inset-y-0 left-0 bg-seal-faint transition-[width]" style={{ width: `${pct}%` }} aria-hidden />}
                <span className="relative flex items-center justify-between gap-3">
                  <span className="truncate">{f.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-muted">
                    {pct !== undefined ? `${pct}%` : formatBytes(f.size)}
                    {pct === undefined && (
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded p-0.5 hover:bg-paper">
                        <X size={15} />
                      </button>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
