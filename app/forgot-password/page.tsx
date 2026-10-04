import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 mt-1 text-muted">Enter the email you log in with and we&apos;ll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
