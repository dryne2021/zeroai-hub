import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import { getCategories, getSettings } from "@/lib/settings";
import { PageHeader, Panel, PanelHeader } from "@/components/ui";
import { CategoryManager, SettingsForm } from "@/components/admin/forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, categories] = await Promise.all([getSettings(), getCategories(true)]);
  return (
    <>
      <PageHeader title="Platform settings" />
      <div className="space-y-6">
        <Panel>
          <PanelHeader title="Fees and rules" description="Changes apply to new orders. Existing orders keep the fee they were paid with." />
          <div className="px-5 py-5"><SettingsForm settings={settings} /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Categories" description="Hidden categories disappear from the homepage and the post-a-task form. Existing tasks keep theirs." />
          <div className="px-5 py-5"><CategoryManager categories={categories} /></div>
        </Panel>
      </div>
    </>
  );
}
