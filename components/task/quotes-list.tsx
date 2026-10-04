"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Avatar, Badge, Button, Stars } from "@/components/ui";
import { PayPanel } from "@/components/task/pay-panel";
import { formatDate, formatMoney, displayName } from "@/lib/format";
import type { PublicProfile, Quote } from "@/lib/types";

export type QuoteWithExpert = Quote & { expert: PublicProfile | null };

export function QuotesList({ taskId, quotes, canPay }: { taskId: string; quotes: QuoteWithExpert[]; canPay: boolean }) {
  const [paying, setPaying] = useState<string | null>(null);
  const sorted = [...quotes].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || a.price - b.price);

  return (
    <ul className="space-y-3">
      {sorted.map((q) => {
        const name = displayName(q.expert?.full_name, "Expert");
        const inactive = q.status !== "pending";
        return (
          <li key={q.id} className={inactive ? "opacity-60" : ""}>
            {paying === q.id ? (
              <PayPanel taskId={taskId} quoteId={q.id} amount={q.price} expertName={name} onClose={() => setPaying(null)} />
            ) : (
              <div className="rounded-panel border border-thread bg-white p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="font-semibold">
                        {name}
                        {q.assigned_by_admin && <Badge className="ml-2" tone="seal">Matched by ZeroAI Hub</Badge>}
                        {inactive && <Badge className="ml-2" tone="neutral">{q.status === "withdrawn" ? "Withdrawn" : q.status === "accepted" ? "Hired" : "Declined"}</Badge>}
                      </p>
                      <p className="num font-display text-xl font-bold">{formatMoney(q.price)}</p>
                    </div>
                    <p className="truncate text-sm text-muted">{q.expert?.headline}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <Stars value={q.expert?.rating_avg} count={q.expert?.rating_count} />
                      <span className="inline-flex items-center gap-1 text-muted">
                        <CalendarClock size={14} aria-hidden /> Delivers by {formatDate(q.delivery_date)}
                      </span>
                    </div>
                  </div>
                </div>
                {q.note && <p className="mt-3 whitespace-pre-line rounded-control bg-paper px-3 py-2.5 text-[15px] leading-relaxed">{q.note}</p>}
                {!inactive && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Link href={`/tasks/${taskId}?thread=${q.expert_id}#chat`} scroll={false} className="inline-flex h-11 items-center justify-center rounded-control border border-thread px-4 text-[15px] font-semibold hover:border-ink/40">
                      Message {name.split(" ")[0]}
                    </Link>
                    {canPay && (
                      <Button variant="seal" onClick={() => setPaying(q.id)}>
                        Accept and pay {formatMoney(q.price)}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
