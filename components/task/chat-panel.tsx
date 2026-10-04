"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send, ShieldAlert } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markThreadRead } from "@/app/actions/messages";
import { uploadToStorage } from "@/lib/upload";
import { containsContactDetails } from "@/lib/contact-filter";
import { formatBytes, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui";
import type { Message } from "@/lib/types";

export interface Thread {
  expertId: string;
  name: string;
  unread: number;
}

export function ChatPanel({
  taskId,
  currentUserId,
  threads,
  activeExpertId,
  initialMessages,
  names,
  contactUnlocked,
  canSend,
}: {
  taskId: string;
  currentUserId: string;
  threads: Thread[];
  activeExpertId: string | null;
  initialMessages: Message[];
  names: Record<string, string>;
  contactUnlocked: boolean;
  canSend: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [active, setActive] = useState(activeExpertId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>(Object.fromEntries(threads.map((t) => [t.expertId, t.unread])));
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Load a thread when switching
  useEffect(() => {
    if (!active) return;
    if (active === activeExpertId) setMessages(initialMessages);
    else {
      supabase
        .from("messages")
        .select("*")
        .eq("task_id", taskId)
        .eq("expert_id", active)
        .order("created_at")
        .limit(500)
        .then(({ data }) => setMessages((data as Message[]) ?? []));
    }
    setUnread((u) => ({ ...u, [active]: 0 }));
    markThreadRead(taskId, active).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Realtime: new messages on this task
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${taskId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `task_id=eq.${taskId}` }, (payload) => {
        const m = payload.new as Message;
        if (m.expert_id === activeRef.current) {
          setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
          if (m.sender_id !== currentUserId) markThreadRead(taskId, m.expert_id).catch(() => null);
        } else if (m.sender_id !== currentUserId) {
          setUnread((u) => ({ ...u, [m.expert_id]: (u[m.expert_id] ?? 0) + 1 }));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, taskId, currentUserId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, active]);

  const warn = !contactUnlocked && containsContactDetails(body);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!active || sending || (!body.trim() && !file)) return;
    setSending(true);
    try {
      let attachment: { path: string; name: string; size: number } | null = null;
      if (file) {
        const up = await uploadToStorage(file, { kind: "chat", taskId, threadExpertId: active });
        attachment = { path: up.path, name: up.name, size: up.size };
      }
      const res = await sendMessage({ taskId, expertId: active, body, file: attachment });
      if (!res.ok) throw new Error(res.error);
      const sent = res.sent;
      if (sent) setMessages((list) => (list.some((x) => x.id === sent.id) ? list : [...list, sent]));
      if (sent?.was_masked) toast.info("Contact details were hidden. They can be shared once the task is funded.");
      setBody("");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message not sent.");
    } finally {
      setSending(false);
    }
  }

  if (!active) {
    return <p className="px-5 py-10 text-center text-sm text-muted">Conversations start when an expert messages you or sends a quote.</p>;
  }

  return (
    <div className="flex h-[560px] max-h-[75vh] flex-col">
      {threads.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-thread px-3 py-2" role="tablist" aria-label="Conversations">
          {threads.map((t) => (
            <button
              key={t.expertId}
              role="tab"
              aria-selected={active === t.expertId}
              onClick={() => setActive(t.expertId)}
              className={clsx(
                "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
                active === t.expertId ? "bg-ink text-white" : "text-muted hover:bg-ink-faint",
              )}
            >
              {t.name.split(" ")[0]}
              {(unread[t.expertId] ?? 0) > 0 && <span className="num rounded-full bg-seal px-1.5 text-xs text-white">{unread[t.expertId]}</span>}
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello and ask anything about the task.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const isTeam = !(m.sender_id in names) || names[m.sender_id] === "ZeroAI Hub team";
          const name = isTeam ? "ZeroAI Hub team" : names[m.sender_id];
          const shortName = isTeam ? "ZeroAI Hub team" : name.split(" ")[0];
          return (
            <div key={m.id} className={clsx("flex gap-2", mine && "flex-row-reverse")}>
              {!mine && <Avatar name={name} size={28} />}
              <div className={clsx("max-w-[82%]", mine && "text-right")}>
                <div
                  className={clsx(
                    "inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-[15px] leading-relaxed",
                    mine ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-paper text-ink",
                  )}
                >
                  {m.body}
                  {m.file_path && (
                    <a href={`/api/chat-files/${m.id}`} className={clsx("mt-1 flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2", !m.body && "mt-0")}>
                      <Paperclip size={14} aria-hidden /> {m.file_name} {m.file_size ? `(${formatBytes(m.file_size)})` : ""}
                    </a>
                  )}
                </div>
                <p className="mt-0.5 px-1 text-[11px] text-muted">
                  {!mine && `${shortName}, `}
                  {timeAgo(m.created_at)}
                  {m.was_masked && " (contact details hidden)"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {canSend ? (
        <form onSubmit={send} className="border-t border-thread p-3">
          {warn && (
            <p className="mb-2 flex items-start gap-1.5 text-xs text-amber">
              <ShieldAlert size={14} className="mt-px shrink-0" aria-hidden /> Phone numbers and emails are hidden until the task is funded. Keep the conversation here so you&apos;re protected.
            </p>
          )}
          {file && (
            <p className="mb-2 flex items-center justify-between rounded-control bg-paper px-3 py-1.5 text-sm">
              <span className="truncate">{file.name}</span>
              <button type="button" className="text-muted" onClick={() => setFile(null)}>Remove</button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-thread text-muted hover:text-ink" aria-label="Attach a file">
              <Paperclip size={18} />
            </button>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 25 * 1024 * 1024) toast.error("Chat files can be up to 25 MB.");
                else setFile(f ?? null);
                e.target.value = "";
              }}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement).requestSubmit();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Write a message"
              className="input max-h-36 min-h-[44px] resize-none"
              aria-label="Message"
            />
            <button type="submit" disabled={sending || (!body.trim() && !file)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-ink text-white disabled:bg-ink/40" aria-label="Send">
              <Send size={18} />
            </button>
          </div>
        </form>
      ) : (
        <p className="border-t border-thread px-4 py-3 text-center text-sm text-muted">This conversation is read-only.</p>
      )}
    </div>
  );
}
