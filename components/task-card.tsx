import Link from "next/link";
import { CalendarClock, MessageSquare } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { HumanMadeBadge } from "@/components/seal";
import { formatDate, formatMoney } from "@/lib/format";
import type { Task } from "@/lib/types";

export function budgetLabel(task: Pick<Task, "budget_min" | "budget_max">) {
  if (task.budget_min && task.budget_max) return `${formatMoney(task.budget_min)} to ${formatMoney(task.budget_max)}`;
  return "Flat price";
}

export function TaskCard({ task, categoryName, quoteCount, extra, price }: { task: Task; categoryName?: string; quoteCount?: number; extra?: React.ReactNode; price?: number }) {
  return (
    <Link href={`/tasks/${task.id}`} className="panel block p-5 transition-colors hover:border-ink/30">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        {task.status === "completed" && !task.ai_confirmed && <HumanMadeBadge />}
        {categoryName && <span className="text-sm text-muted">{categoryName}</span>}
      </div>
      <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug">{task.title}</h3>
      <p className="mt-1 line-clamp-2 text-[15px] text-muted">{task.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
        {price !== undefined ? <span className="num font-semibold text-ink">{formatMoney(price)}</span> : null}
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock size={15} aria-hidden /> Due {formatDate(task.deadline)}
        </span>
        {quoteCount !== undefined && (
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare size={15} aria-hidden /> {quoteCount} {quoteCount === 1 ? "expert ready" : "experts ready"}
          </span>
        )}
        {extra}
      </div>
    </Link>
  );
}
