"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => setUnread(initialUnread), [initialUnread]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setUnread((n) => n + 1);
          const n = payload.new as { title: string; link: string | null; type: string };
          if (n.type !== "new_message" || !window.location.pathname.startsWith("/tasks/")) {
            toast(n.title, n.link ? { action: { label: "Open", onClick: () => (window.location.href = n.link!) } } : undefined);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link href="/notifications" className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-ink-faint" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
      <Bell size={19} aria-hidden />
      {unread > 0 && (
        <span className="num absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-seal px-1 text-center text-[11px] font-bold leading-[18px] text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
