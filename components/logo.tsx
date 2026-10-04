import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex shrink-0 items-center gap-2 whitespace-nowrap" aria-label="ZeroAI Hub home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="#14213D" />
        <circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" strokeWidth="2.4" />
        <path d="M9.5 22.5 22.5 9.5" stroke="#1E7B4F" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[19px] font-bold tracking-tight text-ink">
        ZeroAI<span className="font-medium text-muted"> Hub</span>
      </span>
    </Link>
  );
}
