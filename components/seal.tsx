import clsx from "clsx";

/**
 * The "100% Human-Made" rubber stamp. It is the one bold graphic in the product:
 * shown on the homepage and on every completed task.
 */
export function HumanMadeSeal({ size = 220, id = "seal", animate = false, className, tone = "seal" }: { size?: number; id?: string; animate?: boolean; className?: string; tone?: "seal" | "mint" }) {
  const ring = "100% HUMAN-MADE • NO AI USED • ZEROAI HUB • ";
  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      role="img"
      aria-label="100% Human-Made seal"
      className={clsx("-rotate-[10deg]", tone === "mint" ? "text-mint" : "text-seal mix-blend-multiply", animate && "stamp-in", className)}
    >
      <defs>
        <path id={`${id}-ring`} d="M110,110 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        <filter id={`${id}-ink`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.75" result="speckle" />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" result="inked" />
          <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="1" seed="3" result="wobble" />
          <feDisplacementMap in="inked" in2="wobble" scale="2.2" />
        </filter>
      </defs>
      <g filter={`url(#${id}-ink)`} fill="none" stroke="currentColor">
        <circle cx="110" cy="110" r="104" strokeWidth="5" />
        <circle cx="110" cy="110" r="95" strokeWidth="1.5" />
        <circle cx="110" cy="110" r="62" strokeWidth="1.5" />
        <text fill="currentColor" stroke="none" fontFamily="'Bricolage Grotesque Variable', system-ui, sans-serif" fontSize="15.5" fontWeight="700" letterSpacing="2.6">
          <textPath href={`#${id}-ring`} startOffset="0">{ring + ring.slice(0, 6)}</textPath>
        </text>
        <text x="110" y="113" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="'Bricolage Grotesque Variable', system-ui, sans-serif" fontSize="40" fontWeight="800">
          100%
        </text>
        <text x="110" y="136" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="'Bricolage Grotesque Variable', system-ui, sans-serif" fontSize="14" fontWeight="700" letterSpacing="1">
          Human-Made
        </text>
        <path d="M84 146 h52" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

/** Compact inline badge for task cards and headers. */
export function HumanMadeBadge({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border border-seal/30 bg-seal-faint py-0.5 pl-1 pr-2.5 text-xs font-semibold text-seal-dark", className)}>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden className="text-seal">
        <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="5.6" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="1.4 1.2" />
        <path d="M7 10.2l2 2 4-4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      100% Human-Made
    </span>
  );
}
