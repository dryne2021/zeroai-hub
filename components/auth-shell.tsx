import type { ReactNode } from "react";
import { CalendarCheck, Lock, ShieldCheck } from "lucide-react";
import { HumanMadeSeal } from "@/components/seal";

const POINTS = [
  { icon: ShieldCheck, title: "100% human-made", body: "Every expert signs a no-AI pledge and shares drafts as they work." },
  { icon: Lock, title: "Protected payments", body: "Your payment is held in escrow until you approve the work." },
  { icon: CalendarCheck, title: "On-time delivery", body: "Delivery dates are agreed up front, before any work starts." },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-content gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1fr_480px] lg:gap-12">
      <aside className="relative hidden overflow-hidden rounded-[20px] bg-night p-10 pb-40 text-white lg:block">
        <div className="hero-dots absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <p className="font-display text-[40px] font-extrabold leading-[1.05] tracking-tight text-white">Real work by real people. Zero AI.</p>
          <p className="mt-4 max-w-sm text-white/70">IT projects, essays and books, done by vetted human experts and delivered on time.</p>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#7FD3A8]">
                  <Icon size={20} aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-white">{title}</span>
                  <span className="block text-sm text-white/65">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <HumanMadeSeal size={150} id="auth-seal" tone="mint" className="absolute -bottom-6 -right-4 opacity-90" />
      </aside>
      <div className="panel self-start p-6 shadow-[0_24px_48px_-28px_rgba(20,33,61,0.35)] sm:p-9">{children}</div>
    </div>
  );
}
