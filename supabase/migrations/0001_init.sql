-- ZeroAI Hub: core schema, row-level security, storage buckets and realtime.
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to run once on a fresh project.
-- Money: every amount column (price, amount, budget, fee, payout...) is an integer number of US cents.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('client', 'expert', 'admin');
create type public.expert_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.task_status as enum (
  'draft', 'open', 'quoted', 'funded', 'in_progress', 'delivered', 'revision', 'completed', 'disputed', 'cancelled'
);
create type public.file_kind as enum ('brief', 'draft', 'final');
create type public.quote_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.escrow_status as enum ('pending', 'held', 'released', 'refunded');
create type public.payment_method as enum ('card');
create type public.payout_method as enum ('bank', 'wise', 'payoneer', 'mpesa');
create type public.payout_status as enum ('requested', 'processing', 'paid', 'rejected');
create type public.dispute_status as enum ('open', 'resolved');
create type public.dispute_resolution as enum ('refund', 'partial_refund', 'release');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  full_name text,
  avatar_url text,
  role public.user_role not null default 'client',
  is_banned boolean not null default false,
  banned_reason text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text not null default 'briefcase',
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  id int primary key default 1 check (id = 1),
  fee_percent numeric(5, 2) not null default 15 check (fee_percent >= 0 and fee_percent <= 50),
  min_withdrawal int not null default 2000 check (min_withdrawal >= 0), -- cents ($20)
  auto_accept_days int not null default 5 check (auto_accept_days between 1 and 30),
  revisions_included int not null default 2 check (revisions_included between 0 and 10),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1);

create table public.expert_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  headline text not null,
  bio text not null,
  skills text[] not null default '{}',
  category_ids uuid[] not null default '{}',
  portfolio_links text[] not null default '{}',
  portfolio_files jsonb not null default '[]',
  years_experience int not null default 0,
  location text,
  -- payout details (experts can be anywhere; payouts are sent by an admin)
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_swift text,
  bank_country text,
  wise_email text,
  payoneer_email text,
  mpesa_phone text,
  pledge_signed_at timestamptz not null,
  pledge_version text not null default 'v1',
  status public.expert_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  title text not null check (char_length(title) between 5 and 140),
  description text not null check (char_length(description) between 20 and 8000),
  deadline timestamptz not null,
  budget_min int check (budget_min is null or budget_min >= 0),
  budget_max int check (budget_max is null or budget_max >= 0),
  status public.task_status not null default 'draft',
  coursework_confirmed boolean not null default false,
  expert_id uuid references public.users (id),
  accepted_quote_id uuid,
  revisions_included int not null default 2,
  revisions_used int not null default 0,
  status_before_dispute public.task_status,
  published_at timestamptz,
  funded_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  auto_accepted boolean not null default false,
  ai_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_range check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create table public.task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  uploader_id uuid not null references public.users (id),
  kind public.file_kind not null,
  version int not null default 1,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes <= 104857600),
  preview_path text,
  preview_status text not null default 'none' check (preview_status in ('none', 'ready', 'unavailable')),
  note text,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  expert_id uuid not null references public.users (id) on delete cascade,
  price int not null check (price >= 500), -- cents, minimum $5
  delivery_date timestamptz not null,
  note text not null default '' check (char_length(note) <= 1000),
  status public.quote_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, expert_id)
);

alter table public.tasks
  add constraint tasks_accepted_quote_fk foreign key (accepted_quote_id) references public.quotes (id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks (id) on delete cascade,
  quote_id uuid not null references public.quotes (id),
  client_id uuid not null references public.users (id),
  expert_id uuid not null references public.users (id),
  amount int not null check (amount > 0),
  fee_percent numeric(5, 2) not null,
  fee_amount int not null,
  expert_amount int not null,
  escrow_status public.escrow_status not null default 'pending',
  payment_method public.payment_method,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'initiated', 'success', 'failed')),
  currency text not null default 'USD',
  provider_reference text unique,
  receipt_number text unique,
  refund_amount int not null default 0,
  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_events (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders (id) on delete set null,
  provider text not null,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  expert_id uuid not null references public.users (id) on delete cascade, -- the conversation thread (client <-> this expert)
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  file_path text,
  file_name text,
  file_size bigint,
  was_masked boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  reviewer_id uuid not null references public.users (id) on delete cascade,
  reviewee_id uuid not null references public.users (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (task_id, reviewer_id)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  order_id uuid not null references public.orders (id),
  opened_by uuid not null references public.users (id),
  reason text not null,
  details text not null default '',
  status public.dispute_status not null default 'open',
  resolution public.dispute_resolution,
  refund_amount int,
  admin_note text,
  resolved_by uuid references public.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_open_dispute_per_task on public.disputes (task_id) where status = 'open';

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.users (id) on delete cascade,
  amount int not null check (amount > 0),
  method public.payout_method not null,
  destination text not null,
  status public.payout_status not null default 'requested',
  provider_reference text,
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_audits (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  admin_id uuid not null references public.users (id),
  outcome text not null check (outcome in ('clear', 'ai_confirmed')),
  note text,
  created_at timestamptz not null default now()
);

-- Indexes
create index on public.tasks (client_id, created_at desc);
create index on public.tasks (expert_id);
create index on public.tasks (status, category_id);
create index on public.task_files (task_id, kind, version);
create index on public.quotes (expert_id);
create index on public.orders (client_id);
create index on public.orders (expert_id, escrow_status);
create index on public.messages (task_id, expert_id, created_at);
create index on public.notifications (user_id, created_at desc);
create index on public.payouts (expert_id, created_at desc);
create index on public.reviews (reviewee_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin' and not is_banned);
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and not is_banned);
$$;

create or replace function public.is_approved_expert_for(cat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.expert_profiles ep join public.users u on u.id = ep.user_id
    where ep.user_id = auth.uid() and ep.status = 'approved' and not u.is_banned and cat = any (ep.category_ids)
  );
$$;

create or replace function public.can_view_task(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tasks k
    where k.id = t and (
      k.client_id = auth.uid()
      or k.expert_id = auth.uid()
      or public.is_admin()
      or (k.status in ('open', 'quoted') and public.is_approved_expert_for(k.category_id))
      or exists (select 1 from public.quotes q where q.task_id = k.id and q.expert_id = auth.uid())
    )
  );
$$;

create or replace function public.is_task_client(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks where id = t and client_id = auth.uid());
$$;

create or replace function public.is_task_party(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks where id = t and (client_id = auth.uid() or expert_id = auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a public.users row for every new auth user. Role "admin" can never be self-assigned.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'client');
begin
  insert into public.users (id, email, phone, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case when requested = 'expert' then 'expert'::public.user_role else 'client'::public.user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger quotes_touch before update on public.quotes for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger expert_profiles_touch before update on public.expert_profiles for each row execute function public.touch_updated_at();

-- Replace any run of 9+ digits (with spaces, dashes, dots or brackets) with a placeholder.
create or replace function public.mask_phones(input text) returns text
language plpgsql immutable as $$
declare
  m text;
  result text := input;
begin
  for m in select (regexp_matches(input, '(\+?\d[\d\s\-\.\(\)]{6,}\d)', 'g'))[1] loop
    if length(regexp_replace(m, '\D', '', 'g')) >= 9 then
      result := replace(result, m, '[phone hidden]');
    end if;
  end loop;
  return result;
end;
$$;

-- Mask phone numbers and email addresses in chat until the task is funded and the
-- message belongs to the hired expert's thread.
create or replace function public.mask_contact_details() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k public.tasks%rowtype;
  original text := new.body;
begin
  select * into k from public.tasks where id = new.task_id;
  if k.status in ('draft', 'open', 'quoted') or k.expert_id is distinct from new.expert_id then
    new.body := regexp_replace(new.body, '[A-Za-z0-9._%+\-]+\s*(@|\(at\)|\[at\])\s*[A-Za-z0-9\-]+((\.|\s*\(dot\)\s*|\s*\[dot\]\s*)[A-Za-z]{2,})+', '[email hidden]', 'gi');
    new.body := regexp_replace(new.body, '[A-Za-z0-9._%+\-]+\s+at\s+[A-Za-z0-9\-]+\s+dot\s+[A-Za-z]{2,}', '[email hidden]', 'gi');
    new.body := public.mask_phones(new.body);
    new.body := regexp_replace(new.body, '(wa\.me|whatsapp\.com|t\.me|telegram\.me)/\S+', '[link hidden]', 'gi');
    if new.body is distinct from original then
      new.was_masked := true;
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_mask before insert on public.messages
for each row execute function public.mask_contact_details();

-- First quote on an open task moves it to "quoted".
create or replace function public.on_quote_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.tasks set status = 'quoted' where id = new.task_id and status = 'open';
  return new;
end;
$$;

create trigger quotes_after_insert after insert on public.quotes
for each row execute function public.on_quote_created();

-- Keep expert rating aggregates current.
create or replace function public.refresh_expert_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.expert_profiles ep set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where reviewee_id = new.reviewee_id), 0),
    rating_count = (select count(*) from public.reviews where reviewee_id = new.reviewee_id)
  where ep.user_id = new.reviewee_id;
  return new;
end;
$$;

create trigger reviews_after_insert after insert on public.reviews
for each row execute function public.refresh_expert_rating();

-- A final file can only be stored once the task has at least one draft.
create or replace function public.require_draft_before_final() returns trigger
language plpgsql as $$
begin
  if new.kind = 'final' and not exists (
    select 1 from public.task_files where task_id = new.task_id and kind = 'draft'
  ) then
    raise exception 'A draft must be uploaded before the final file';
  end if;
  return new;
end;
$$;

create trigger task_files_draft_rule before insert on public.task_files
for each row execute function public.require_draft_before_final();

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
-- Public-safe identity fields (no email/phone) so parties can see each other's names.
create view public.public_profiles as
  select u.id, u.full_name, u.avatar_url, u.role, u.created_at,
         ep.headline, ep.rating_avg, ep.rating_count, ep.status as expert_status
  from public.users u left join public.expert_profiles ep on ep.user_id = u.id;

-- Expert earnings ledger. security_invoker makes it obey the caller's RLS.
create view public.expert_earnings with (security_invoker = true) as
  select
    u.id as expert_id,
    coalesce((select sum(expert_amount) from public.orders o where o.expert_id = u.id and o.escrow_status = 'released'), 0)::int as earned,
    coalesce((select sum(expert_amount) from public.orders o where o.expert_id = u.id and o.escrow_status = 'held'), 0)::int as in_escrow,
    coalesce((select sum(amount) from public.payouts p where p.expert_id = u.id and p.status = 'paid'), 0)::int as paid_out,
    coalesce((select sum(amount) from public.payouts p where p.expert_id = u.id and p.status in ('requested', 'processing')), 0)::int as pending_payouts
  from public.users u
  where u.role = 'expert';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.platform_settings enable row level security;
alter table public.expert_profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_files enable row level security;
alter table public.quotes enable row level security;
alter table public.orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.disputes enable row level security;
alter table public.payouts enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_audits enable row level security;

-- users
create policy "users: read self or admin" on public.users for select
  using (id = auth.uid() or public.is_admin());
create policy "users: update own name" on public.users for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.users from authenticated;
grant update (full_name, avatar_url) on public.users to authenticated;

-- categories & settings: readable by everyone, written by the server (service role)
create policy "categories: public read" on public.categories for select using (true);
create policy "settings: public read" on public.platform_settings for select using (true);

-- expert profiles: own row or admin (bank details live here)
create policy "expert_profiles: self or admin" on public.expert_profiles for select
  using (user_id = auth.uid() or public.is_admin());

-- tasks
-- Columns are checked inline (not via can_view_task) so INSERT ... RETURNING sees the new row.
create policy "tasks: visible to parties, eligible experts, admin" on public.tasks for select
  using (
    client_id = auth.uid()
    or expert_id = auth.uid()
    or public.is_admin()
    or (status in ('open', 'quoted') and public.is_approved_expert_for(category_id))
    or exists (select 1 from public.quotes q where q.task_id = tasks.id and q.expert_id = auth.uid())
  );
create policy "tasks: clients create" on public.tasks for insert
  with check (client_id = auth.uid() and status in ('draft', 'open') and public.is_active_user()
              and expert_id is null and accepted_quote_id is null);
create policy "tasks: clients edit before funding" on public.tasks for update
  using (client_id = auth.uid() and status in ('draft', 'open'))
  with check (client_id = auth.uid() and status in ('draft', 'open'));
revoke update on public.tasks from authenticated;
grant update (title, description, deadline, budget_min, budget_max, category_id, status, coursework_confirmed, published_at)
  on public.tasks to authenticated;

-- task files: briefs visible to anyone who can see the task; drafts/finals only to the parties and admin
create policy "task_files: scoped read" on public.task_files for select
  using (
    (kind = 'brief' and public.can_view_task(task_id))
    or public.is_task_party(task_id)
    or public.is_admin()
  );

-- quotes
create policy "quotes: expert, task client, admin" on public.quotes for select
  using (expert_id = auth.uid() or public.is_task_client(task_id) or public.is_admin());
create policy "quotes: approved experts create" on public.quotes for insert
  with check (
    expert_id = auth.uid() and status = 'pending'
    and exists (select 1 from public.tasks k where k.id = task_id and k.status in ('open', 'quoted')
                and k.client_id <> auth.uid() and public.is_approved_expert_for(k.category_id))
  );
create policy "quotes: experts edit own pending" on public.quotes for update
  using (expert_id = auth.uid() and status = 'pending')
  with check (expert_id = auth.uid() and status in ('pending', 'withdrawn'));
revoke update on public.quotes from authenticated;
grant update (price, delivery_date, note, status) on public.quotes to authenticated;

-- orders (written only by the payments service)
create policy "orders: parties and admin" on public.orders for select
  using (client_id = auth.uid() or expert_id = auth.uid() or public.is_admin());

create policy "payment_events: admin" on public.payment_events for select using (public.is_admin());

-- messages
create policy "messages: thread members and admin" on public.messages for select
  using (expert_id = auth.uid() or public.is_task_client(task_id) or public.is_admin());
create policy "messages: thread members send" on public.messages for insert
  with check (
    sender_id = auth.uid() and public.is_active_user()
    and (
      (public.is_task_client(task_id) and (
        exists (select 1 from public.quotes q where q.task_id = messages.task_id and q.expert_id = messages.expert_id)
        or exists (select 1 from public.messages m where m.task_id = messages.task_id and m.expert_id = messages.expert_id)
        or exists (select 1 from public.tasks k where k.id = messages.task_id and k.expert_id = messages.expert_id)
      ))
      or (expert_id = auth.uid() and public.can_view_task(task_id))
    )
  );

-- reviews are public reputation
create policy "reviews: public read" on public.reviews for select using (true);

create policy "disputes: parties and admin" on public.disputes for select
  using (public.is_task_party(task_id) or public.is_admin());

create policy "payouts: own or admin" on public.payouts for select
  using (expert_id = auth.uid() or public.is_admin());

create policy "notifications: own" on public.notifications for select using (user_id = auth.uid());
create policy "notifications: mark read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "ai_audits: admin" on public.ai_audits for select using (public.is_admin());

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;
grant select on public.expert_earnings to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: every bucket is private. The app hands out short-lived signed URLs
-- from the server after checking permissions, so no client-side storage
-- policies are needed (and none are granted).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('task-files', 'task-files', false, 104857600),
  ('previews', 'previews', false, 52428800),
  ('chat-files', 'chat-files', false, 26214400),
  ('portfolios', 'portfolios', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.orders;

-- ---------------------------------------------------------------------------
-- Launch categories
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name, description, icon, sort_order) values
  ('writing-editing', 'Writing & Editing', 'Articles, CVs, proposals, proofreading and copy that sounds like you.', 'pen-line', 10),
  ('design', 'Design', 'Logos, social graphics, posters, slide decks and brand kits.', 'palette', 20),
  ('data-spreadsheets', 'Data & Spreadsheets', 'Excel models, data cleaning, dashboards and reports.', 'table', 30),
  ('programming', 'Programming', 'Websites, scripts, bug fixes and small apps, written line by line.', 'code', 40),
  ('translation', 'Translation', 'English, French, Spanish, Kiswahili and more, translated by native speakers.', 'languages', 50)
on conflict (slug) do nothing;
