import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { NewPasswordForm } from "@/components/password-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect("/forgot-password");
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-muted">Use at least 10 characters with letters and numbers.</p>
      <NewPasswordForm />
    </AuthShell>
  );
}
