-- ZeroAI Hub v4 update. Run this ONCE in the Supabase SQL Editor after 0001_init.sql.
-- Adds: flat task price, admin-created experts with first-login onboarding,
-- admin-assigned tasks, client-only sign-up, and the new service categories.

-- Flat price per task (cents). Default $20.
alter table public.platform_settings add column if not exists task_price int not null default 2000 check (task_price >= 100);

-- Experts are created by an admin. They set their own password and sign the pledge on first login.
alter table public.expert_profiles alter column pledge_signed_at drop not null;
alter table public.expert_profiles alter column headline set default '';
alter table public.expert_profiles alter column bio set default '';
alter table public.expert_profiles add column if not exists onboarded_at timestamptz;
alter table public.expert_profiles add column if not exists created_by uuid references public.users (id);
update public.expert_profiles set onboarded_at = pledge_signed_at where onboarded_at is null and pledge_signed_at is not null;

-- Mark quotes that an admin created by assigning an expert directly.
alter table public.quotes add column if not exists assigned_by_admin boolean not null default false;

-- Public sign-up only ever creates client accounts. Experts and admins are created by an admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, phone, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Approved reviews can be shown publicly on the homepage (first name and last initial only).
create or replace view public.public_reviews as
  select r.id, r.rating, r.comment, r.created_at,
         split_part(coalesce(u.full_name, ''), ' ', 1) as first_name,
         left(nullif(split_part(coalesce(u.full_name, ''), ' ', 2), ''), 1) as last_initial,
         c.name as category
  from public.reviews r
  join public.users u on u.id = r.reviewer_id and u.role = 'client'
  join public.tasks t on t.id = r.task_id
  join public.categories c on c.id = t.category_id
  where r.rating >= 4 and char_length(r.comment) >= 20;
grant select on public.public_reviews to anon, authenticated;

-- Service categories: IT projects first, then writing and publishing.
update public.categories set is_active = false
  where slug not in ('software-development', 'it-cloud', 'data-analytics', 'essay-writing', 'book-publishing', 'design');

insert into public.categories (slug, name, description, icon, sort_order, is_active) values
  ('software-development', 'Software & App Development', 'Web apps, mobile apps, APIs, integrations, bug fixes and code reviews.', 'code', 10, true),
  ('it-cloud', 'IT, Cloud & DevOps', 'Cloud setup, servers, networking, CI/CD, automation and security hardening.', 'server', 20, true),
  ('data-analytics', 'Data & Analytics', 'Databases, SQL, dashboards, Excel and Python analysis, and reports.', 'chart', 30, true),
  ('essay-writing', 'Essay & Content Writing', 'Essays, research papers, articles, blog posts and website copy.', 'pen-line', 40, true),
  ('book-publishing', 'Book Writing & Publishing', 'Ghostwriting, editing, formatting, cover design and self-publishing.', 'book', 50, true),
  ('design', 'UI/UX & Graphic Design', 'App and website interfaces, logos, brand kits and presentations.', 'palette', 60, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  sort_order = excluded.sort_order, is_active = true;
