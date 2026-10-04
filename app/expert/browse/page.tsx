import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requireOnboardedExpert } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getSettings } from "@/lib/settings";
import { Badge, Container, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { TaskCard } from "@/components/task-card";
import type { Task } from "@/lib/types";

export const metadata: Metadata = { title: "Find tasks" };

export default async function BrowseTasks({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { user, profile } = await requireOnboardedExpert("/expert/browse");
  if (!profile || profile.status !== "approved") {
    return (
      <Container className="max-w-2xl py-12">
        <EmptyState title="Your account isn't active" body="Contact the ZeroAI Hub team to reactivate your expert account." action={<LinkButton href="/expert">Back to my work</LinkButton>} />
      </Container>
    );
  }
  const { category, q } = await searchParams;
  const price = (await getSettings()).task_price;
  const supabase = await createClient();
  const categories = (await getCategories(true)).filter((c) => profile.category_ids.includes(c.id));
  const activeCat = categories.find((c) => c.slug === category);

  let query = supabase
    .from("tasks")
    .select("*")
    .in("status", ["open", "quoted"])
    .in("category_id", activeCat ? [activeCat.id] : profile.category_ids)
    .neq("client_id", user.id)
    .order("published_at", { ascending: false })
    .limit(60);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const [{ data }, { data: myQuotes }] = await Promise.all([query, supabase.from("quotes").select("task_id").eq("expert_id", user.id)]);
  const tasks = (data ?? []) as Task[];
  const quoted = new Set((myQuotes ?? []).map((x) => x.task_id));

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader title="Find tasks" description="Open tasks in the categories you're approved for. Newest first." />
      <form className="mb-4 flex gap-2" action="/expert/browse">
        {category && <input type="hidden" name="category" value={category} />}
        <input name="q" defaultValue={q} placeholder="Search task titles" className="input max-w-md" aria-label="Search task titles" />
        <button className="rounded-control border border-thread bg-white px-4 font-semibold">Search</button>
      </form>
      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Categories">
        <Link href="/expert/browse" className={clsx("whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold", !activeCat ? "border-ink bg-ink text-white" : "border-thread bg-white text-muted")}>
          All my categories
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/expert/browse?category=${c.slug}`} className={clsx("whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold", activeCat?.id === c.id ? "border-ink bg-ink text-white" : "border-thread bg-white text-muted")}>
            {c.name}
          </Link>
        ))}
      </nav>
      {tasks.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {tasks.map((t) => (
            <TaskCard
              price={price}
              key={t.id}
              task={t}
              categoryName={categories.find((c) => c.id === t.category_id)?.name}
              extra={quoted.has(t.id) ? <Badge tone="seal">Offer sent</Badge> : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No open tasks right now" body="New tasks appear here as soon as clients publish them. The team may also assign tasks to you directly." />
      )}
    </Container>
  );
}
