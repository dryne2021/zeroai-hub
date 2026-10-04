"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Briefcase, ShieldCheck, User } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { signInAs } from "@/app/actions/auth";
import { Button, Notice } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import type { Role } from "@/lib/types";

const TABS: { role: Role; label: string; icon: typeof User; blurb: string }[] = [
  { role: "client", label: "Client", icon: User, blurb: "Post tasks, pay securely and track your orders." },
  { role: "expert", label: "Expert", icon: Briefcase, blurb: "Use the login details the ZeroAI Hub team sent you." },
  { role: "admin", label: "Admin", icon: ShieldCheck, blurb: "For the ZeroAI Hub team only." },
];

export function GoogleButton({ next, label = "Continue with Google" }: { next: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const { error } = await createClient().auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
          });
          if (error) {
            setError(error.message);
            setBusy(false);
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {label}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </>
  );
}

export function LoginForm({ initialRole, next, notice }: { initialRole: Role; next: string; notice?: string | null }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tab = TABS.find((t) => t.role === role)!;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Log in as" className="grid grid-cols-3 gap-1 rounded-xl bg-paper p-1 ring-1 ring-inset ring-thread">
        {TABS.map(({ role: r, label, icon: Icon }) => (
          <button
            key={r}
            role="tab"
            type="button"
            aria-selected={role === r}
            onClick={() => {
              setRole(r);
              setError(null);
              router.replace(`/login?role=${r}${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`, { scroll: false });
            }}
            className={clsx(
              "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
              role === r ? "bg-white text-ink shadow-[0_1px_3px_rgba(20,33,61,0.12)]" : "text-muted hover:text-ink",
            )}
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div>
        <h1 className="text-2xl font-bold">Log in as {tab.label.toLowerCase() === "admin" ? "an admin" : `a${tab.label === "Expert" ? "n" : ""} ${tab.label.toLowerCase()}`}</h1>
        <p className="mt-1 text-muted">{tab.blurb}</p>
      </div>

      {notice && <Notice tone="danger">{notice}</Notice>}

      {role === "client" && (
        <>
          <GoogleButton next={next} />
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-thread" /> or with email <span className="h-px flex-1 bg-thread" />
          </div>
        </>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const res = await signInAs({ role, email: String(f.get("email") || ""), password: String(f.get("password") || ""), next });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            router.replace(res.redirect || "/dashboard");
            router.refresh();
          });
        }}
      >
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-semibold" htmlFor="password">Password</label>
            <Link href="/forgot-password" className="text-sm font-medium text-muted hover:text-ink">Forgot password?</Link>
          </div>
          <PasswordInput id="password" />
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Logging in…" : `Log in as ${tab.label.toLowerCase()}`}
        </Button>
      </form>

      {role === "client" ? (
        <p className="text-center text-sm text-muted">
          New to ZeroAI Hub?{" "}
          <Link className="font-semibold text-ink underline-offset-4 hover:underline" href={`/signup${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}>
            Create a client account
          </Link>
        </p>
      ) : role === "expert" ? (
        <p className="text-center text-sm text-muted">Expert accounts are created by the ZeroAI Hub team. Lost your details? Ask the team to reset your password.</p>
      ) : null}
    </div>
  );
}

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  if (checkEmail) {
    return (
      <Notice tone="seal">
        <p className="font-semibold">Check your inbox</p>
        <p className="mt-1">We sent a confirmation link to your email. Open it on this device to finish creating your account.</p>
      </Notice>
    );
  }

  return (
    <div className="space-y-5">
      <GoogleButton next={next} label="Sign up with Google" />
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-thread" /> or with email <span className="h-px flex-1 bg-thread" />
      </div>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const password = String(f.get("password") || "");
          setError(null);
          if (password.length < 8) return setError("Use a password of at least 8 characters.");
          setBusy(true);
          const { data, error } = await createClient().auth.signUp({
            email: String(f.get("email") || "").trim(),
            password,
            options: {
              data: { full_name: String(f.get("full_name") || "").trim() },
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });
          setBusy(false);
          if (error) return setError(error.message);
          if (data.session) {
            router.replace(next);
            router.refresh();
          } else setCheckEmail(true);
        }}
      >
        <div>
          <label className="label" htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" required autoComplete="name" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="new-password" />
          <p className="hint">At least 8 characters.</p>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? "Creating account…" : "Create client account"}</Button>
      </form>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-semibold text-ink underline-offset-4 hover:underline" href="/login">Log in</Link>
      </p>
      <p className="text-center text-xs text-muted">
        By creating an account you agree to the <Link href="/terms" className="underline">terms of use</Link> and the <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </div>
  );
}
