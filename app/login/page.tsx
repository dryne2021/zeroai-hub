import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import type { Role } from "@/lib/types";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const role: Role = sp.role === "expert" || sp.role === "admin" ? sp.role : "client";
  const next = safeNext(sp.next);
  const user = await getCurrentUser();
  if (user) redirect(next !== "/dashboard" ? next : homeFor(user.profile.role));
  return (
    <AuthShell>
      <LoginForm key={role} initialRole={role} next={next} notice={sp.error ? "That sign-in link didn't work or has expired. Try again." : null} />
    </AuthShell>
  );
}
