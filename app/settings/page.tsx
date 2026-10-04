import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Badge, Container, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const p = user.profile;
  return (
    <Container className="max-w-2xl py-8 sm:py-10">
      <PageHeader title="Account settings" />
      <div className="space-y-6">
        <Panel>
          <PanelHeader title="Profile" description="Your name is shown to the people you work with." />
          <div className="px-5 py-5"><ProfileForm name={p.full_name ?? ""} /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Sign-in details" />
          <dl className="divide-y divide-thread text-[15px]">
            <div className="flex justify-between px-5 py-3"><dt className="text-muted">Email</dt><dd>{user.email || "Not set"}</dd></div>
            <div className="flex justify-between px-5 py-3"><dt className="text-muted">Phone</dt><dd>{p.phone || "Not set"}</dd></div>
            <div className="flex justify-between px-5 py-3"><dt className="text-muted">Account type</dt><dd><Badge tone="info">{p.role}</Badge></dd></div>
            <div className="flex justify-between px-5 py-3"><dt className="text-muted">Member since</dt><dd>{formatDate(p.created_at)}</dd></div>
          </dl>
        </Panel>
        {p.role === "expert" && (
          <p className="text-sm text-muted">Payout details live on your <Link href="/expert/earnings" className="font-semibold text-ink underline">earnings page</Link>.</p>
        )}
      </div>
    </Container>
  );
}
