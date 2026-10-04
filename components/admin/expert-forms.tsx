"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAction } from "@/components/use-action";
import { Button, Notice } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
import { createExpertAccount, resetExpertPassword, updateExpertProfile } from "@/app/actions/admin";
import type { Category } from "@/lib/types";

type Credentials = { email: string; password: string; name: string };

export function CredentialsCard({ creds, loginUrl, onClose }: { creds: Credentials; loginUrl: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Hi ${creds.name.split(" ")[0] || "there"},\n\nYour ZeroAI Hub expert account is ready.\n\nLog in: ${loginUrl}\nChoose the "Expert" tab.\nEmail: ${creds.email}\nTemporary password: ${creds.password}\n\nYou'll choose your own password and sign the no-AI pledge when you first log in.`;
  return (
    <div className="rounded-panel border-2 border-seal/40 bg-seal-faint/40 p-5">
      <p className="font-display text-lg font-bold">Login details for {creds.name}</p>
      <p className="mt-1 text-sm text-muted">Send these to the expert privately. The temporary password isn&apos;t shown again; you can always reset it.</p>
      <dl className="mt-4 grid gap-2 text-[15px] sm:grid-cols-[140px_1fr]">
        <dt className="text-muted">Login page</dt>
        <dd className="break-all font-medium">{loginUrl}</dd>
        <dt className="text-muted">Email</dt>
        <dd className="font-medium">{creds.email}</dd>
        <dt className="text-muted">Temporary password</dt>
        <dd className="num font-mono text-base font-semibold">{creds.password}</dd>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Copied. Paste it into an email or message to the expert.");
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} Copy message for the expert
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

export function AddExpertForm({ categories, loginUrl }: { categories: Category[]; loginUrl: string }) {
  const { run, pending, error } = useAction();
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (creds) return <CredentialsCard creds={creds} loginUrl={loginUrl} onClose={() => setCreds(null)} />;

  return (
    <form
      key={formKey}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(async () => {
          const res = await createExpertAccount({
            full_name: String(f.get("full_name") || ""),
            email: String(f.get("email") || ""),
            headline: String(f.get("headline") || ""),
            skills: String(f.get("skills") || "").split(",").map((s) => s.trim()).filter(Boolean),
            category_ids: f.getAll("category_ids").map(String),
          });
          if (res.ok && res.credentials) {
            setCreds(res.credentials);
            setFormKey((k) => k + 1);
          }
          return res;
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ex-name">Full name</label>
          <input id="ex-name" name="full_name" required className="input" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="ex-email">Email</label>
          <input id="ex-email" name="email" type="email" required className="input" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="ex-headline">Headline</label>
          <input id="ex-headline" name="headline" maxLength={120} placeholder="e.g. Senior full-stack developer" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ex-skills">Skills</label>
          <input id="ex-skills" name="skills" placeholder="React, Node.js, AWS" className="input" />
        </div>
      </div>
      <fieldset>
        <legend className="label">Categories this expert can work in</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-control border border-thread bg-white px-3 py-2.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink-faint">
              <input type="checkbox" name="category_ids" value={c.id} className="h-4 w-4 accent-[#14213D]" />
              <CategoryIcon name={c.icon} size={16} className="text-seal" />
              <span className="font-medium">{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" disabled={pending}>
        <UserPlus size={17} /> {pending ? "Creating…" : "Create expert account"}
      </Button>
    </form>
  );
}

export function ResetPasswordButton({ userId, loginUrl }: { userId: string; loginUrl: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);
  if (creds) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 p-4" role="dialog" aria-modal="true" aria-label="New login details">
        <div className="w-full max-w-lg rounded-panel bg-white p-2 shadow-2xl">
          <CredentialsCard
            creds={creds}
            loginUrl={loginUrl}
            onClose={() => {
              setCreds(null);
              router.refresh();
            }}
          />
        </div>
      </div>
    );
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Create a new temporary password? The expert's current password stops working.")) return;
        setPending(true);
        const res = await resetExpertPassword(userId).catch(() => null);
        setPending(false);
        if (res?.ok && res.credentials) setCreds(res.credentials);
        else toast.error(res && !res.ok ? res.error : "Could not reset the password.");
      }}
    >
      <KeyRound size={15} /> Reset password
    </Button>
  );
}

export function EditExpertForm({
  userId,
  categories,
  headline,
  skills,
  categoryIds,
}: {
  userId: string;
  categories: Category[];
  headline: string;
  skills: string[];
  categoryIds: string[];
}) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Edit</Button>;
  return (
    <form
      className="mt-3 w-full space-y-3 rounded-control bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            updateExpertProfile(userId, {
              headline: String(f.get("headline") || ""),
              skills: String(f.get("skills") || "").split(",").map((s) => s.trim()).filter(Boolean),
              category_ids: f.getAll("category_ids").map(String),
            }),
          () => setOpen(false),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="headline" defaultValue={headline} placeholder="Headline" className="input" aria-label="Headline" />
        <input name="skills" defaultValue={skills.join(", ")} placeholder="Skills" className="input" aria-label="Skills" />
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <label key={c.id} className="flex items-center gap-2 rounded-full border border-thread bg-white px-3 py-1.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink-faint">
            <input type="checkbox" name="category_ids" value={c.id} defaultChecked={categoryIds.includes(c.id)} className="h-3.5 w-3.5 accent-[#14213D]" />
            {c.name}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={pending}>Save</Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
