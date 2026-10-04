# ZeroAI Hub

**Real work by real people. Zero AI.**

A US-based marketplace where clients post IT projects, essays and book work, and vetted human experts complete them without AI. Every task is a flat price (default $20), paid by card in US dollars through Paystack and held in escrow. Experts must show drafts before delivering, clients only see watermarked previews until they accept, and admins assign experts, step in on payments and run spot audits for AI use.

## Who logs in where

The login page has three tabs: **Client**, **Expert** and **Admin**. Each account can only log in on its own tab.

- **Clients** sign up themselves at `/signup` (email and password, or Google).
- **Experts** can't sign up. An admin creates their account at **/admin/experts** and gets a temporary password to send them. On first login the expert chooses their own password and signs the no-AI pledge.
- **The admin** account comes from the `ADMIN_EMAIL` and `ADMIN_PASSWORD` settings in Vercel. Logging in on the Admin tab with exactly those details creates the account the first time. If you ever forget the admin password, change `ADMIN_PASSWORD` in Vercel, redeploy and log in with the new one.

Built with Next.js 15 (App Router) + TypeScript + Tailwind CSS, and Supabase (Postgres, Auth, Storage, Realtime). Hosted on Vercel.

---

## What's included

| Area | Where |
| --- | --- |
| Homepage: hero, "How it works", categories, human-made guarantee | `app/page.tsx` |
| Sign up / log in: email + password, Google, phone OTP | `app/login`, `app/signup`, `components/auth-form.tsx`, `app/auth/callback` |
| Post a task (title, category, brief, attachments up to 100 MB, deadline) at the flat price | `app/tasks/new`, `components/task-form.tsx` |
| Task room: quotes, card checkout, chat, drafts, final delivery, previews, revisions, acceptance, download, ratings, disputes | `app/tasks/[id]/page.tsx`, `components/task/*` |
| Real-time chat per task with file sharing; phones, emails and WhatsApp/Telegram links masked until funding | `components/task/chat-panel.tsx`, DB trigger `mask_contact_details` |
| Role-based login (Client / Expert / Admin), client-only sign-up, password reset | `app/login`, `app/signup`, `app/forgot-password`, `app/actions/auth.ts` |
| Admin-created expert accounts, first-login password and no-AI pledge | `app/admin/experts`, `app/expert/welcome` |
| Admin assign/reassign experts, release or refund payments, join task chats | `components/admin/task-tools.tsx`, `app/actions/admin.ts` |
| AI & plagiarism reports on tasks (expert or admin uploads, client opens any time), sample reports on the homepage | `components/task/file-list.tsx`, `app/page.tsx`, `public/proof/` |
| Expert dashboard, task browser (only approved categories), earnings and withdrawals | `app/expert/*` |
| Client dashboard, order history, printable receipts | `app/client/*`, `app/orders/[id]/receipt` |
| Admin: expert approvals, all tasks/chats/files, AI spot audits, disputes, payouts, bans, fee and category settings | `app/admin/*` |
| Payments service with escrow states `pending → held → released / refunded` | `lib/payments/escrow.ts`, `lib/payments/paystack.ts` |
| Watermarked / partial previews (images, PDF, DOCX, XLSX, text and code) | `lib/preview.ts` |
| In-app + email notifications (new quote, payment, delivery, revision, message) | `lib/notify.ts`, `components/notification-bell.tsx` |
| Auto-accept 5 days after delivery | `app/api/cron/auto-accept`, `vercel.json` (also runs when a task page is opened) |
| Terms of use and privacy policy | `app/terms` |
| Database schema, RLS, storage buckets, realtime | `supabase/migrations/0001_init.sql` |

### Money

- Every task costs the same flat price, set by the admin (default **$20**). Experts offer to take a task by choosing a delivery date; the admin can also assign an expert directly, before or after payment.
- Clients pay by card in **US dollars** through Paystack's hosted checkout. Every amount in the database is an integer number of **US cents** (`2000` = $20.00).
- The platform fee (default 15%) is taken from the expert's side and stored on each order when it's paid, so changing the fee never affects paid orders.
- Refunds from disputes and AI audits go back to the client's card automatically through Paystack's refund API.
- Experts withdraw to a bank account (ACH or wire), Wise or Payoneer. An admin sends each payout and marks it paid with the transfer reference. Minimum withdrawal: $20 (configurable).

### Task statuses

`Draft → Open → Quoted → Funded → In progress ⇄ Revision → Delivered → Completed`, plus `Disputed` and `Cancelled` (used for unfunded cancellations, full refunds and confirmed AI use).

### How the no-AI rules are enforced

- Experts sign the pledge with their full name before they can quote.
- A database trigger refuses a final file unless the task already has a draft, and the UI and API enforce the same rule.
- `/admin/audits` draws a fresh random sample of completed, un-audited tasks every visit.
- **AI use confirmed** refunds the client, cancels the task, records the audit and suspends the expert.
- Completed tasks and the homepage show the **100% Human-Made** seal.

### File security

- All four storage buckets (`task-files`, `previews`, `chat-files`, `portfolios`) are **private** with no client-side storage policies.
- Browsers upload straight to Storage with one-time signed upload URLs issued by `/api/files/upload-url` after a permission check, so 100 MB files never pass through a serverless function.
- Downloads go through `/api/files/[id]`, which checks the caller and redirects to a signed URL that expires after `SIGNED_URL_TTL_SECONDS` (default 5 minutes).
- Clients get only the watermarked preview of drafts and finals. The original final file unlocks only when escrow is `released`.

### Row-level security

Every table has RLS on. Clients see their own tasks, quotes on them, their chats, orders and files. Experts see open tasks in their approved categories, their own quotes, threads and assigned tasks. Payout details, payment logs and audits are visible only to the owner and admins. Money movements and status changes run on the server with the service-role key after explicit permission checks.

---

## Step 1. Put the code on GitHub

Install [Git](https://git-scm.com/downloads), create an **empty private repository** on GitHub (no README, no .gitignore), then in a terminal:

```bash
cd zeroai-hub
git init
git add .
git commit -m "Initial commit: ZeroAI Hub"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/zeroai-hub.git
git push -u origin main
```

GitHub asks you to sign in on the first push. If it asks for a password, use a [personal access token](https://github.com/settings/tokens) instead, or sign in with the [GitHub CLI](https://cli.github.com/) (`gh auth login`).

`.env.local` is in `.gitignore`, so your keys never reach GitHub.

## Step 2. Create the Supabase project (free plan is fine to start)

**Option A: through Vercel.** While importing the project, choose the Supabase integration under Optional Integrations, leave the custom prefix empty, leave "Supabase Preview Branch" unticked, and click Connect. Vercel creates the project and adds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`, which the app accepts. Then open Supabase from Vercel's **Storage** tab and continue from point 2 below.

**Option B: directly.**

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of `supabase/migrations/0001_init.sql` and click **Run**. It creates the tables, RLS policies, triggers, the four private buckets and realtime.
   Then open a new query, paste the whole of `supabase/migrations/0002_v4_update.sql` and click **Run**. It adds the flat task price, admin-created experts, admin assignment, client-only sign-up and the service categories.
   Finally, open another new query and run `supabase/migrations/0003_reports.sql`. It adds AI & plagiarism report files on tasks and the report service category.
   Run each file once, in order. If you've already run some of them, run only the ones after. `0002` and `0003` are safe to run again.
3. Copy these from **Project Settings → API** for Step 4: Project URL, `anon` public key, `service_role` key.
4. **Upload limit.** The free plan caps each file at 50 MB. For 100 MB files, move to Pro and set **Storage → Settings → Upload file size limit** to `100 MB`.
5. **Free plan pause.** A free project pauses after 7 days with no activity. Open the site now and then while testing, and upgrade before launch.

## Step 3. Set up Paystack

1. Create an account at [paystack.com](https://paystack.com) and complete the business verification.
2. In **Settings → Preferences**, turn on **international payments** and **USD**. Paystack activates this within about 48 working hours once your business is verified. To receive USD settlements, you need a USD account at a Kenyan bank.
3. Copy your **test** secret key (`sk_test_…`) from **Settings → API Keys & Webhooks**.
4. After Step 4, set the webhook URL on the same page to `https://YOUR-SITE/api/payments/paystack/webhook`.
5. Test cards: Paystack lists them in its docs ("Test payments"). Switch to your live key when you go live.

## Step 4. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub and import the `zeroai-hub` repository. Vercel detects Next.js; leave the build settings as they are.
2. Before clicking **Deploy**, open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://zeroai-hub.vercel.app` (your Vercel URL; change it when you add a domain) |
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (keep secret) |
   | `PAYSTACK_SECRET_KEY` | `sk_test_…` |
   | `CRON_SECRET` | any long random string |
   | `SIGNED_URL_TTL_SECONDS` | `300` |
   | `ADMIN_EMAIL` | the email you log in with as admin |
   | `ADMIN_PASSWORD` | the admin password (keep it secret; at least 12 characters) |
   | `RESEND_API_KEY`, `EMAIL_FROM` | optional, for emails |

3. Click **Deploy**. Every `git push` to `main` redeploys automatically.
4. **Plan:** Vercel's free Hobby plan is for non-commercial use. Test on Hobby, then upgrade to Pro before taking real payments.

## Step 5. Connect Supabase Auth to your site

In Supabase, **Authentication → URL Configuration**:
- Site URL: your Vercel URL (later, your domain)
- Redirect URLs: `https://YOUR-SITE/auth/callback` and `http://localhost:3000/auth/callback`

**Authentication → Providers**:
- Email: on, with "Confirm email" on.
- Google: create an OAuth client in Google Cloud Console, add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect URI, and paste the client ID and secret into Supabase.
- Phone (optional): turn it on and connect an SMS provider such as Twilio. Users enter numbers with their country code.

## Step 6. Log in as admin and add experts

1. Open your site, click **Log in**, choose the **Admin** tab and enter `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
2. Go to **Experts → Add an expert**. Enter the expert's name, email and categories, then click **Create expert account**.
3. Click **Copy message for the expert** and send it to them privately. It contains the login link, their email and a temporary password.
4. When they first log in on the **Expert** tab, they choose their own password and sign the no-AI pledge. Use **Reset password** on the Experts page if they lose it.

## Adding your domain later

1. In Vercel: **Project → Settings → Domains → Add**, then set the DNS records Vercel shows at your domain registrar.
2. Change `NEXT_PUBLIC_SITE_URL` in Vercel to `https://yourdomain.com` and redeploy.
3. Update the Supabase Site URL and Redirect URL, the Google OAuth settings, and the Paystack webhook URL to the new domain.

## Email (optional)

Notifications are always stored in-app. To also email them, create a [Resend](https://resend.com) account, verify your domain and set `RESEND_API_KEY` and `EMAIL_FROM`.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase and Paystack keys
npm run dev
```

Open http://localhost:3000. Node 20.9 or newer.

## Platform settings

Admins change these at **/admin/settings**: price per task (default $20), platform fee (default 15%), minimum withdrawal (default $20), auto-accept window (default 5 days), revisions included (default 2), and categories.

## Go-live checklist

- [ ] Both migrations run on the production Supabase project
- [ ] `ADMIN_EMAIL` and `ADMIN_PASSWORD` set in Vercel, first admin login done
- [ ] Supabase Pro with a 100 MB upload limit
- [ ] Email confirmation on; Google (and phone, if wanted) configured
- [ ] Paystack international payments and USD enabled, live key set, webhook URL set
- [ ] Vercel Pro plan, domain added, `NEXT_PUBLIC_SITE_URL` updated
- [ ] Resend domain verified
- [ ] `CRON_SECRET` set and the cron job visible in Vercel
- [ ] Terms of use reviewed by a lawyer

## Project layout

```
app/
  actions/          server actions (tasks, quotes, messages, disputes, payouts, admin…)
  api/              file upload/download, Paystack payments, cron
  admin/ client/ expert/ tasks/ orders/ …   pages
components/         UI, task room, admin forms, the Human-Made seal
lib/
  payments/         Paystack client and the escrow service
  preview.ts        watermark and partial-preview generator
  files.ts          storage paths and download permission rules
  notify.ts         in-app + email notifications
supabase/migrations/0001_init.sql
```

## Testing notes

The full loop was tested end to end in a browser against Postgres with these exact migrations and RLS policies, PostgREST and a mocked Paystack: sign-up for all three roles, expert application and approval, posting with attachments, contact masking, quoting in dollars, card payment into escrow with the 15% split, the draft-before-final rule, watermarked previews, blocked final download before acceptance, a revision round with version history, acceptance and signed download, ratings, receipts, withdrawal limits and payouts, a dispute with a partial refund, AI-use confirmation with refund and suspension, webhook signature checks, and access checks for unrelated users. Run your own pass with Paystack test cards before going live.
