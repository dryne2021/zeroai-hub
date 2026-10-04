-- ZeroAI Hub v5 update. Run ONCE in the Supabase SQL Editor after 0002_v4_update.sql.
-- Adds AI & plagiarism report files on tasks, and the report service category.

alter type public.file_kind add value if not exists 'report';

insert into public.categories (slug, name, description, icon, sort_order, is_active) values
  ('originality-reports', 'AI & Plagiarism Reports', 'A Turnitin AI report and similarity (plagiarism) report for a document you already have.', 'file-check', 70, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  sort_order = excluded.sort_order, is_active = true;
