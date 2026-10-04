"use client";

export type UploadKind = "brief" | "draft" | "final" | "report" | "chat" | "portfolio";

export interface UploadedObject {
  path: string;
  name: string;
  size: number;
  type: string;
}

async function readError(res: Response) {
  const body = await res.json().catch(() => ({}));
  return (body as { error?: string }).error || `Upload failed (${res.status})`;
}

/**
 * Uploads straight to private Supabase Storage with a one-time signed URL from our API,
 * so large files (up to 100 MB) never pass through the Next.js server.
 */
export async function uploadToStorage(
  file: File,
  opts: { kind: UploadKind; taskId?: string; threadExpertId?: string; onProgress?: (pct: number) => void },
): Promise<UploadedObject> {
  const res = await fetch("/api/files/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: opts.kind, taskId: opts.taskId, threadExpertId: opts.threadExpertId, fileName: file.name, size: file.size }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const { signedUrl, path } = (await res.json()) as { signedUrl: string; path: string };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and try again."));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });

  return { path, name: file.name, size: file.size, type: file.type };
}

/** Upload a brief, draft or final file and register it on the task (versioning + preview). */
export async function uploadTaskFile(
  file: File,
  opts: { taskId: string; kind: "brief" | "draft" | "final" | "report"; note?: string; onProgress?: (pct: number) => void },
) {
  const obj = await uploadToStorage(file, { kind: opts.kind, taskId: opts.taskId, onProgress: opts.onProgress });
  const res = await fetch("/api/files/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: opts.taskId, kind: opts.kind, path: obj.path, fileName: file.name, mimeType: file.type, note: opts.note }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
