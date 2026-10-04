import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markAllNotificationsRead } from "@/app/actions/account";
import { Button, Container, EmptyState, PageHeader } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser("/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const items = (data ?? []) as Notification[];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Container className="max-w-2xl py-8 sm:py-10">
      <PageHeader
        title="Notifications"
        action={
          unread > 0 && (
            <form action={markAllNotificationsRead}>
              <Button variant="secondary" size="sm">Mark all as read</Button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState title="You're all caught up" body="New quotes, payments, deliveries, revision requests and messages show up here and in your email." />
      ) : (
        <ul className="panel divide-y divide-thread overflow-hidden">
          {items.map((n) => {
            const inner = (
              <div className="flex gap-3">
                <span className={clsx("mt-2 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-seal")} aria-hidden />
                <div className="min-w-0">
                  <p className={clsx("text-[15px]", !n.read_at && "font-semibold")}>{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? <Link href={n.link} className="block px-5 py-4 hover:bg-paper">{inner}</Link> : <div className="px-5 py-4">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
