import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getCategories, getSettings } from "@/lib/settings";
import { Container, PageHeader } from "@/components/ui";
import { TaskForm } from "@/components/task-form";

export const metadata: Metadata = { title: "Post a task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireRole("client", "/tasks/new");
  const [{ category }, categories, settings] = await Promise.all([searchParams, getCategories(), getSettings()]);
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader title="Post a task" description="Vetted experts in your chosen category will offer to take it on, or our team will match you with one. You pay only when you accept." />
      <div className="panel p-5 sm:p-8">
        <TaskForm categories={categories} initialCategory={category} price={settings.task_price} />
      </div>
    </Container>
  );
}
