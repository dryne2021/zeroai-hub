"use client";

import { useState } from "react";
import { useAction } from "@/components/use-action";
import { Button, Notice } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { completeOnboarding } from "@/app/actions/expert";
import { PLEDGE_POINTS } from "@/lib/pledge";

export function WelcomeForm({ fullName, needsPledge }: { fullName: string; needsPledge: boolean }) {
  const { run, pending, error } = useAction();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pledge, setPledge] = useState(false);
  const [signature, setSignature] = useState("");

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => completeOnboarding({ password, confirm, pledge, signature }));
      }}
    >
      <fieldset className="space-y-4">
        <legend className="mb-1 font-display text-xl font-bold">Choose your password</legend>
        <p className="text-sm text-muted">Replace the temporary password you were given. Use at least 10 characters with letters and numbers.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="new-password">New password</label>
            <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">Confirm password</label>
            <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </div>
        </div>
      </fieldset>

      {needsPledge && (
        <fieldset className="rounded-panel border-2 border-seal/40 bg-seal-faint/50 p-5">
          <legend className="px-1 font-display text-xl font-bold">The no-AI pledge</legend>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
            {PLEDGE_POINTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <label className="mt-5 flex items-start gap-3 text-[15px] font-medium">
            <input type="checkbox" checked={pledge} onChange={(e) => setPledge(e.target.checked)} className="mt-1 h-4 w-4 accent-[#1E7B4F]" />
            I have read and agree to the no-AI pledge.
          </label>
          <div className="mt-4">
            <label className="label" htmlFor="signature">Sign by typing your full name ({fullName})</label>
            <input id="signature" value={signature} onChange={(e) => setSignature(e.target.value)} autoComplete="off" className="input font-display text-lg italic sm:max-w-sm" />
          </div>
        </fieldset>
      )}

      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save and continue"}</Button>
    </form>
  );
}
