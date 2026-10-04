import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { createAdminClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/settings";
import { env } from "@/lib/env";
import { Avatar, Badge, EmptyState, PageHeader, Panel, PanelHeader, Stars } from "@/components/ui";
import { ExpertReviewButtons } from "@/components/admin/forms";
import { AddExpertForm, EditExpertForm, ResetPasswordButton } from "@/components/admin/expert-forms";
import { formatDate } from "@/lib/format";
import type { ExpertProfile } from "@/lib/types";

export const metadata: Metadata = { title: "Experts" };

const TABS = [
  { key: "active", label: "Active" },
  { key: "invited", label: "Not logged in yet" },
  { key: "suspended", label: "Suspended" },
] as const;

type Row = ExpertProfile & { users: { full_name: string | null; email: string | null; created_at: string } | null };

export default async function AdminExperts({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.key === raw)?.key ?? "active";
  const db = createAdminClient();
  const [{ data }, categories, { data: jobs }] = await Promise.all([
    db.from("expert_profiles").select("*, users!expert_profiles_user_id_fkey(full_name, email, created_at)").order("created_at", { ascending: false }),
    getCategories(true),
    db.from("tasks").select("expert_id, status").not("expert_id", "is", null),
  ]);
  const all = (data ?? []) as Row[];
  const groups = {
    active: all.filter((e) => e.status === "approved" && e.onboarded_at),
    invited: all.filter((e) => e.status === "approved" && !e.onboarded_at),
    suspended: all.filter((e) => e.status === "suspended" || e.status === "rejected"),
  };
  const shown = groups[tab];
  const loginUrl = `${env.siteUrl()}/login?role=expert`;
  const activeCats = categories.filter((c) => c.is_active);
  const jobCount = (id: string) => (jobs ?? []).filter((j) => j.expert_id === id && j.status !== "cancelled").length;

  return (
    <>
      <PageHeader title="Experts" description="Experts can't sign up on their own. Create their login here, then send them the details." />
      <Panel className="mb-8">
        <PanelHeader title="Add an expert" description="We create the account with a temporary password. On first login they choose their own password and sign the no-AI pledge." />
        <div className="px-5 py-5">
          <AddExpertForm categories={activeCats} loginUrl={loginUrl} />
        </div>
      </Panel>

      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Expert status">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/experts?tab=${t.key}`} className={clsx("whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold", t.key === tab ? "border-ink bg-ink text-white" : "border-thread bg-white text-muted")}>
            {t.label} <span className="num ml-1 opacity-70">{groups[t.key].length}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <EmptyState title={tab === "active" ? "No active experts yet" : tab === "invited" ? "Everyone has logged in" : "No suspended experts"} body={tab === "active" ? "Experts appear here after their first login." : undefined} />
      ) : (
        <ul className="space-y-3">
          {shown.map((e) => (
            <li key={e.user_id} className="panel p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <Avatar name={e.users?.full_name} size={44} />
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                      {e.users?.full_name || "Unnamed"}
                      {!e.onboarded_at && e.status === "approved" && <Badge tone="amber">Hasn&apos;t logged in yet</Badge>}
                      {e.pledge_signed_at && <Badge tone="seal">Pledge signed</Badge>}
                    </p>
                    {e.headline && <p className="text-[15px]">{e.headline}</p>}
                    <p className="text-sm text-muted">
                      {e.users?.email}. Added {formatDate(e.created_at)}. {jobCount(e.user_id)} task{jobCount(e.user_id) === 1 ? "" : "s"}.
                    </p>
                    <div className="mt-1"><Stars value={e.rating_avg} count={e.rating_count} /></div>
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <ResetPasswordButton userId={e.user_id} loginUrl={loginUrl} />
                  <ExpertReviewButtons userId={e.user_id} status={e.status} />
                  <EditExpertForm userId={e.user_id} categories={activeCats} headline={e.headline} skills={e.skills} categoryIds={e.category_ids} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {e.category_ids.map((id) => <Badge key={id} tone="info">{categories.find((c) => c.id === id)?.name ?? "Unknown"}</Badge>)}
                {e.skills.map((s) => <Badge key={s}>{s}</Badge>)}
              </div>
              {e.review_note && e.status !== "approved" && <p className="mt-3 text-sm text-muted">Note: {e.review_note}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
