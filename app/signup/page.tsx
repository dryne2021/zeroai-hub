import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/client");
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold">Create your client account</h1>
      <p className="mb-6 mt-1 text-muted">Post your first task in a couple of minutes. Every task is a flat price, paid only when you accept.</p>
      <SignupForm next={next} />
    </AuthShell>
  );
}
