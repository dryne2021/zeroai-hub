import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Category, Settings } from "@/lib/types";

export async function getSettings(): Promise<Settings> {
  const admin = createAdminClient();
  const { data } = await admin.from("platform_settings").select("*").eq("id", 1).single();
  return {
    task_price: Number(data?.task_price ?? 2000),
    fee_percent: Number(data?.fee_percent ?? 15),
    min_withdrawal: Number(data?.min_withdrawal ?? 2000),
    auto_accept_days: Number(data?.auto_accept_days ?? 5),
    revisions_included: Number(data?.revisions_included ?? 2),
  };
}

export async function getCategories(includeInactive = false): Promise<Category[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return FALLBACK_CATEGORIES;
  try {
    const admin = createAdminClient();
    let q = admin.from("categories").select("*").order("sort_order");
    if (!includeInactive) q = q.eq("is_active", true);
    const { data } = await q;
    return (data as Category[]) ?? [];
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

/** Shown on public pages before the database is connected. */
export const FALLBACK_CATEGORIES: Category[] = [
  { id: "1", slug: "software-development", name: "Software & App Development", description: "Web apps, mobile apps, APIs, integrations, bug fixes and code reviews.", icon: "code", is_active: true, sort_order: 10 },
  { id: "2", slug: "it-cloud", name: "IT, Cloud & DevOps", description: "Cloud setup, servers, networking, CI/CD, automation and security hardening.", icon: "server", is_active: true, sort_order: 20 },
  { id: "3", slug: "data-analytics", name: "Data & Analytics", description: "Databases, SQL, dashboards, Excel and Python analysis, and reports.", icon: "chart", is_active: true, sort_order: 30 },
  { id: "4", slug: "essay-writing", name: "Essay & Content Writing", description: "Essays, research papers, articles, blog posts and website copy.", icon: "pen-line", is_active: true, sort_order: 40 },
  { id: "5", slug: "book-publishing", name: "Book Writing & Publishing", description: "Ghostwriting, editing, formatting, cover design and self-publishing.", icon: "book", is_active: true, sort_order: 50 },
  { id: "7", slug: "originality-reports", name: "AI & Plagiarism Reports", description: "A Turnitin AI report and similarity (plagiarism) report for a document you already have.", icon: "file-check", is_active: true, sort_order: 70 },
  { id: "6", slug: "design", name: "UI/UX & Graphic Design", description: "App and website interfaces, logos, brand kits and presentations.", icon: "palette", is_active: true, sort_order: 60 },
];
