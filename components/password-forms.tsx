"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { Button, Notice } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { requestPasswordReset, setNewPassword } from "@/app/actions/auth";

export function ForgotPasswordForm() {
  const { run, pending, error } = useAction();
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <Notice tone="seal">
        <p className="font-semibold">Check your inbox</p>
        <p className="mt-1">If that email has an account, a reset link is on its way. It expires after an hour.</p>
      </Notice>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => requestPasswordReset(String(new FormData(e.currentTarget).get("email") || "")), () => setSent(true));
      }}
    >
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
      <p className="text-center text-sm text-muted">
        Remembered it? <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">Back to log in</Link>
      </p>
    </form>
  );
}

export function NewPasswordForm() {
  const { run, pending, error } = useAction();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setNewPassword(password, confirm));
      }}
    >
      <div>
        <label className="label" htmlFor="new-password">New password</label>
        <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">Confirm new password</label>
        <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Saving…" : "Save new password"}</Button>
    </form>
  );
}
