import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { STATUS_LABEL, STATUS_TONE, initials } from "@/lib/format";
import type { TaskStatus } from "@/lib/types";

type Variant = "primary" | "seal" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-soft disabled:bg-ink/50",
  seal: "bg-seal text-white hover:bg-seal-dark disabled:bg-seal/50",
  secondary: "border border-thread bg-white text-ink hover:border-ink/40 disabled:text-muted",
  ghost: "text-ink hover:bg-ink-faint disabled:text-muted",
  danger: "border border-danger/30 bg-white text-danger hover:bg-danger-faint",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition-colors disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={clsx("panel", className)} {...props} />;
}

export function PanelHeader({ title, action, description }: { title: ReactNode; action?: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-thread px-5 py-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  neutral: "bg-paper text-muted ring-thread",
  info: "bg-ink-faint text-ink ring-ink/10",
  seal: "bg-seal-faint text-seal-dark ring-seal/20",
  amber: "bg-amber-faint text-amber ring-amber/20",
  danger: "bg-danger-faint text-danger ring-danger/20",
} as const;

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function PageHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-thread bg-white px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink-faint font-display font-semibold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function Stars({ value, count }: { value: number | null | undefined; count?: number | null }) {
  const v = Number(value || 0);
  if (!count) return <span className="text-xs text-muted">New expert</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber" aria-hidden>
        {"★".repeat(Math.round(v))}
        <span className="text-thread">{"★".repeat(5 - Math.round(v))}</span>
      </span>
      <span className="num font-semibold">{v.toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="panel px-4 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="num mt-1 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "seal" | "amber" | "danger"; children: ReactNode }) {
  const map = {
    info: "border-ink/10 bg-ink-faint text-ink",
    seal: "border-seal/20 bg-seal-faint text-seal-dark",
    amber: "border-amber/20 bg-amber-faint text-amber",
    danger: "border-danger/20 bg-danger-faint text-danger",
  };
  return <div className={clsx("rounded-control border px-4 py-3 text-sm leading-relaxed", map[tone])}>{children}</div>;
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("mx-auto w-full max-w-content px-4 sm:px-6", className)} {...props} />;
}
