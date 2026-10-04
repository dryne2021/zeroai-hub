import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  Check,
  FileCheck,
  ChartColumn,
  Code,
  FileStack,
  Lock,
  MessageSquare,
  Palette,
  PenLine,
  Plus,
  Server,
  ShieldCheck,
  Star,
} from "lucide-react";
import { getCategories, getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { HumanMadeSeal } from "@/components/seal";
import { Container, LinkButton } from "@/components/ui";
import { formatMoney } from "@/lib/format";

type PublicReview = { id: string; rating: number; comment: string; first_name: string | null; last_initial: string | null; category: string };

async function getReviews(): Promise<PublicReview[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  try {
    const { data } = await createAdminClient().from("public_reviews").select("*").order("created_at", { ascending: false }).limit(6);
    return (data as PublicReview[]) ?? [];
  } catch {
    return [];
  }
}

const STEPS = [
  { title: "Post your task", body: "Describe what you need, attach files up to 100 MB and set your deadline." },
  { title: "Get matched", body: "Vetted experts offer to take it on, or our team assigns the best fit for you." },
  { title: "Pay into escrow", body: "Pay the flat price by card. We hold the money until you approve the work." },
  { title: "Review and download", body: "Follow along through drafts, ask for up to 2 revisions, then download the final files." },
];

const PILLARS = [
  { icon: ShieldCheck, title: "No AI, ever", body: "Experts sign a no-AI pledge, share real drafts as they work, and our team audits completed tasks at random." },
  { icon: Lock, title: "Escrow protection", body: "Your payment is held safely until you accept the work. Not happy? Ask for a revision or open a dispute." },
  { icon: CalendarCheck, title: "On-time delivery", body: "Every expert commits to your deadline before work starts. Late work can be disputed for a refund." },
  { icon: MessageSquare, title: "A real person to talk to", body: "Chat with your expert directly on every task, and reach the ZeroAI Hub team whenever you need us." },
];

const INCLUDED = [
  "A vetted human expert, no AI",
  "Delivery by your deadline",
  "Drafts you can review as work progresses",
  "2 revisions included",
  "Turnitin AI report and plagiarism report",
  "Payment held in escrow until you approve",
  "Full ownership of the final files",
];

const FAQ = [
  { q: "How do you make sure no AI is used?", a: "Every expert signs a no-AI pledge before they can work. They must upload at least one draft before the final file, so the work leaves a visible trail, and our team audits a random sample of completed tasks. If we confirm AI use, you get a full refund and the expert is removed." },
  { q: "What does the flat price cover?", a: "Each task is one clearly defined piece of work, such as fixing a bug, writing an essay or formatting a manuscript. Larger projects can be split into several tasks. Every task includes drafts, 2 revisions and escrow protection." },
  { q: "When does the expert get paid?", a: "Only after you accept the work. Until then, your payment sits in escrow. If you don't respond within 5 days of delivery, the work is accepted automatically." },
  { q: "What if the work is late or not right?", a: "Ask for a revision, or open a dispute while your payment is still in escrow. Our team reviews the brief, files and messages, then decides on a refund, partial refund or release." },
  { q: "Do I get an AI report and a plagiarism report?", a: "Yes. Writing tasks are delivered with a Turnitin AI report and a plagiarism (similarity) report attached to your task, so you can check the work is human-written and original before you accept it. You can also order the two reports on their own for a document you already have." },
  { q: "Who owns the finished work?", a: "You do. Once you accept, the final files are yours to use however you like." },
  { q: "How do I pay?", a: "By debit or credit card in US dollars, through our payment processor, Paystack. We never see or store your card details." },
];

export default async function HomePage() {
  const [categories, user, settings, reviews] = await Promise.all([getCategories(), getCurrentUser(), getSettings().catch(() => null), getReviews()]);
  const price = formatMoney(settings?.task_price ?? 2000);
  const postHref = user ? "/tasks/new" : "/signup?next=/tasks/new";
  const catHref = (slug: string) => (user ? `/tasks/new?category=${slug}` : `/signup?next=${encodeURIComponent(`/tasks/new?category=${slug}`)}`);
  const cat = (slug: string) => categories.find((c) => c.slug === slug);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-night text-white">
        <div className="hero-dots absolute inset-0" aria-hidden />
        <div className="hero-glow absolute -right-40 top-10 h-[640px] w-[640px]" aria-hidden />
        <Container className="relative grid items-center gap-14 pb-24 pt-14 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pb-28 lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
              <BadgeCheck size={16} className="text-mint" aria-hidden /> IT projects, essays and books, done by people
            </p>
            <h1 className="mt-6 font-display text-[44px] font-extrabold leading-[0.98] tracking-[-0.035em] text-white sm:text-6xl lg:text-[74px]">
              Real work by real people. Zero AI.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Hand your software projects, essays and books to vetted human experts. One flat price of {price} per task, paid into escrow and
              delivered on time.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <LinkButton href={postHref} size="lg" variant="seal" className="px-7">
                Post a task for {price}
              </LinkButton>
              <Link href="#how-it-works" className="inline-flex h-12 items-center justify-center rounded-control border border-white/25 px-6 font-semibold text-white hover:bg-white/10">
                See how it works
              </Link>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
              {["No AI, ever", "Payment held in escrow", "On-time delivery"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check size={16} className="text-mint" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
            <div className="relative rotate-[1.5deg] rounded-[18px] bg-white p-6 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted">Example task</p>
                <span className="rounded-full bg-seal-faint px-2.5 py-0.5 text-xs font-semibold text-seal-dark">Completed on time</span>
              </div>
              <p className="mt-3 font-display text-xl font-bold leading-snug">Fix checkout errors in a Next.js online store</p>
              <p className="mt-1 text-sm text-muted">Software & App Development, delivered in 2 days</p>
              <ol className="mt-6 space-y-3 border-l-2 border-thread pl-5 text-sm">
                <li className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-thread" />
                  <span className="font-semibold">Draft 1</span> <span className="text-muted">bug reproduced, failing test added</span>
                </li>
                <li className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-thread" />
                  <span className="font-semibold">Draft 2</span> <span className="text-muted">fix running on a staging link</span>
                </li>
                <li className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-seal" />
                  <span className="font-semibold">Final</span> <span className="text-muted">patch, tests and handover notes</span>
                </li>
              </ol>
              <div className="mt-6 flex items-center justify-between border-t border-thread pt-4 text-sm">
                <span className="text-muted">Flat price, paid from escrow</span>
                <span className="num font-display text-lg font-bold">{price}</span>
              </div>
            </div>
            <HumanMadeSeal size={160} id="hero-seal" animate tone="mint" className="absolute -bottom-24 right-2 sm:-bottom-28 sm:-left-24 sm:right-auto" />
          </div>
        </Container>
      </section>

      {/* Assurances */}
      <section aria-label="How you're protected" className="border-b border-thread bg-white">
        <Container className="grid grid-cols-2 gap-x-6 gap-y-5 py-8 text-sm lg:grid-cols-4">
          {[
            { icon: ShieldCheck, text: "100% human-made, guaranteed" },
            { icon: Lock, text: "Payment held in escrow" },
            { icon: CalendarCheck, text: "Delivered by your deadline" },
            { icon: FileCheck, text: "AI and plagiarism reports included" },
          ].map(({ icon: Icon, text }) => (
            <p key={text} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-seal-faint text-seal">
                <Icon size={18} aria-hidden />
              </span>
              <span className="font-semibold">{text}</span>
            </p>
          ))}
        </Container>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-20">
        <Container className="py-20 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold sm:text-[40px] sm:leading-tight">IT projects first. Words and books too.</h2>
            <p className="mt-3 text-lg text-muted">Most of what we deliver is software and IT work. Our writers and publishing specialists handle the rest.</p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            <article className="relative overflow-hidden rounded-[18px] bg-night p-8 text-white lg:col-span-2 lg:row-span-2">
              <div className="hero-dots absolute inset-0 opacity-50" aria-hidden />
              <div className="relative">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-mint">
                  <Code size={24} aria-hidden />
                </span>
                <h3 className="mt-6 text-2xl font-bold text-white sm:text-3xl">IT & software projects</h3>
                <p className="mt-2 max-w-lg text-white/70">Code written line by line by developers and engineers, with drafts you can run and test before you accept.</p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    { slug: "software-development", icon: Code, fallback: "Software & App Development", examples: "Web and mobile apps, APIs, bug fixes, code reviews" },
                    { slug: "it-cloud", icon: Server, fallback: "IT, Cloud & DevOps", examples: "AWS and Azure setup, servers, CI/CD, security" },
                    { slug: "data-analytics", icon: ChartColumn, fallback: "Data & Analytics", examples: "SQL, dashboards, Excel and Python analysis" },
                  ].map(({ slug, icon: Icon, fallback, examples }) => (
                    <Link key={slug} href={catHref(slug)} className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                      <Icon size={20} className="text-mint" aria-hidden />
                      <p className="mt-3 font-semibold text-white">{cat(slug)?.name ?? fallback}</p>
                      <p className="mt-1 text-sm text-white/60">{examples}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </article>
            {[
              { slug: "essay-writing", icon: PenLine, fallback: "Essay & Content Writing", body: "Essays, research papers, articles, blog posts and website copy, written from scratch." },
              { slug: "book-publishing", icon: BookOpen, fallback: "Book Writing & Publishing", body: "Ghostwriting, editing, interior formatting, cover design and self-publishing support." },
            ].map(({ slug, icon: Icon, fallback, body }) => (
              <Link key={slug} href={catHref(slug)} className="group panel flex flex-col p-7 transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(20,33,61,0.35)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-seal-faint text-seal">
                  <Icon size={22} aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-bold">{cat(slug)?.name ?? fallback}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{body}</p>
                <span className="mt-5 text-sm font-semibold text-ink underline-offset-4 group-hover:underline">Post a task</span>
              </Link>
            ))}
            <Link href={catHref("originality-reports")} className="group panel flex flex-col p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-seal-faint text-seal">
                <FileCheck size={22} aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-bold">{cat("originality-reports")?.name ?? "AI & Plagiarism Reports"}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">A Turnitin AI report and plagiarism report for a document you already have.</p>
              <span className="mt-5 text-sm font-semibold text-ink underline-offset-4 group-hover:underline">Order a report</span>
            </Link>
            <Link href={catHref("design")} className="group panel flex items-start gap-4 p-7">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-faint text-ink">
                <Palette size={22} aria-hidden />
              </span>
              <span>
                <span className="block text-xl font-bold">{cat("design")?.name ?? "UI/UX & Graphic Design"}</span>
                <span className="mt-1 block text-[15px] text-muted">App and website interfaces, logos, brand kits and presentations, designed by hand.</span>
              </span>
            </Link>
            <div className="flex flex-col justify-center rounded-[18px] border border-dashed border-thread bg-white p-7">
              <p className="font-display text-lg font-bold">Something else?</p>
              <p className="mt-1 text-[15px] text-muted">Pick the closest category and explain the rest in your brief. We&apos;ll match you with the right person.</p>
            </div>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-thread bg-white">
        <Container className="py-20 sm:py-24">
          <h2 className="text-3xl font-bold sm:text-[40px]">How it works</h2>
          <p className="mt-3 max-w-xl text-lg text-muted">Four steps from brief to download. You stay in control of the money the whole way.</p>
          <ol className="mt-12 grid gap-8 md:grid-cols-4 md:gap-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex gap-4 md:block">
                <span className="num flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-night font-display text-lg font-bold text-white">{i + 1}</span>
                {i < STEPS.length - 1 && <span aria-hidden className="absolute left-[64px] right-0 top-6 hidden h-0.5 bg-thread md:block" />}
                <div className="md:mt-5">
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Why trust */}
      <section id="trust" className="scroll-mt-20">
        <Container className="grid gap-12 py-20 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold sm:text-[40px] sm:leading-tight">Why clients trust ZeroAI Hub</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              If we confirm that AI was used on your task, you get a full refund and the expert is removed from ZeroAI Hub. That&apos;s the
              human-made guarantee.
            </p>
            <HumanMadeSeal size={220} id="trust-seal" className="mt-10" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="panel p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-seal-faint text-seal">
                  <Icon size={22} aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
            <div className="panel flex items-start gap-4 p-6 sm:col-span-2">
              <FileStack size={22} className="mt-0.5 shrink-0 text-seal" aria-hidden />
              <p className="text-[15px] leading-relaxed text-muted">
                <span className="font-semibold text-ink">You see the work take shape.</span> Drafts appear as watermarked previews while your expert works.
                The full files unlock the moment you accept.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Proof: anonymised reports from real deliveries */}
      <section id="proof" className="scroll-mt-20 border-t border-thread bg-white">
        <Container className="py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
            <div className="lg:sticky lg:top-24">
              <p className="inline-flex items-center gap-2 rounded-full bg-seal-faint px-3 py-1 text-sm font-semibold text-seal-dark">
                <FileCheck size={16} aria-hidden /> 0% AI, verified
              </p>
              <h2 className="mt-5 text-3xl font-bold sm:text-[40px] sm:leading-tight">Every writing task comes with its reports</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                Your essay or assignment is delivered with a Turnitin AI report and a plagiarism (similarity) report, so you can see for yourself
                that the work is 100% human and original before you accept it.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  ["Turnitin AI report", "Shows how much of the text is detected as AI-generated or AI-paraphrased."],
                  ["Plagiarism report", "Shows the similarity score against published sources, websites and papers."],
                  ["Yours to keep", "Both reports are attached to your task, ready to open or download at any time."],
                ].map(([title, body]) => (
                  <li key={title} className="flex gap-3">
                    <Check size={20} className="mt-0.5 shrink-0 text-seal" aria-hidden />
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="block text-[15px] text-muted">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-[14px] border border-thread bg-paper p-5">
                <p className="font-semibold">Already have a document?</p>
                <p className="mt-1 text-[15px] text-muted">Order an AI and plagiarism check on its own. Upload your file and get both reports back, for the same flat {price}.</p>
                <Link href={catHref("originality-reports")} className="mt-3 inline-block text-sm font-semibold text-ink underline underline-offset-4">Order a report check</Link>
              </div>
            </div>
            <div className="space-y-6">
              {[
                { src: "/proof/ai-report-essay.png", w: 1564, h: 713, caption: "Summary-response essay, 960 words" },
                { src: "/proof/ai-report-assignment.png", w: 1564, h: 900, caption: "Written assignment, 1,242 words" },
              ].map((r) => (
                <figure key={r.src} className="overflow-hidden rounded-[16px] border border-thread bg-white shadow-[0_24px_50px_-30px_rgba(20,33,61,0.35)]">
                  <div className="flex items-center justify-between gap-3 border-b border-thread bg-paper px-4 py-2.5">
                    <span className="flex gap-1.5" aria-hidden>
                      <span className="h-2.5 w-2.5 rounded-full bg-thread" />
                      <span className="h-2.5 w-2.5 rounded-full bg-thread" />
                      <span className="h-2.5 w-2.5 rounded-full bg-thread" />
                    </span>
                    <span className="rounded-full bg-seal px-2.5 py-0.5 text-xs font-bold text-white">0% AI</span>
                  </div>
                  <Image src={r.src} alt={`Turnitin AI writing report: 0% detected as AI. ${r.caption}.`} width={r.w} height={r.h} className="h-auto w-full" sizes="(min-width: 1024px) 640px, 100vw" />
                  <figcaption className="border-t border-thread px-4 py-3 text-sm text-muted">
                    {r.caption}, written by our team. Personal details removed to protect the client.
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-y border-thread bg-white">
        <Container className="grid items-center gap-12 py-20 sm:py-24 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold sm:text-[40px] sm:leading-tight">One flat price. No bidding, no surprises.</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Every task costs the same, whatever the category. You only pay when you&apos;ve accepted an expert, and the money stays in escrow until
              you approve the work.
            </p>
            <p className="mt-4 text-sm text-muted">Card payments in US dollars, processed securely by Paystack.</p>
          </div>
          <div className="relative overflow-hidden rounded-[20px] bg-night p-8 text-white sm:p-10">
            <div className="hero-dots absolute inset-0 opacity-50" aria-hidden />
            <div className="relative">
              <p className="text-white/70">Per task</p>
              <p className="num mt-1 font-display text-6xl font-extrabold tracking-tight text-white">{price}</p>
              <ul className="mt-8 space-y-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-white/85">
                    <Check size={18} className="mt-0.5 shrink-0 text-mint" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
              <LinkButton href={postHref} variant="seal" size="lg" className="mt-9 w-full">
                Post a task
              </LinkButton>
            </div>
          </div>
        </Container>
      </section>

      {/* Reviews: only real reviews from completed tasks */}
      {reviews.length > 0 && (
        <section id="reviews" className="scroll-mt-20">
          <Container className="py-20 sm:py-24">
            <h2 className="text-3xl font-bold sm:text-[40px]">What clients say</h2>
            <p className="mt-3 text-lg text-muted">Ratings left by clients after their tasks were completed.</p>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r.id} className="panel flex flex-col p-6">
                  <div className="flex gap-0.5 text-amber" aria-label={`${r.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={16} className={i < r.rating ? "fill-current" : "text-thread"} aria-hidden />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed">&ldquo;{r.comment}&rdquo;</blockquote>
                  <figcaption className="mt-5 text-sm">
                    <span className="font-semibold">{[r.first_name, r.last_initial && `${r.last_initial}.`].filter(Boolean).join(" ") || "Verified client"}</span>
                    <span className="text-muted">, {r.category}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20">
        <Container className="grid gap-10 py-20 sm:py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-bold sm:text-[40px]">Questions, answered</h2>
            <p className="mt-3 text-lg text-muted">Anything else? Ask us in the chat on your first task.</p>
          </div>
          <div className="divide-y divide-thread rounded-[18px] border border-thread bg-white">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="faq group px-6 py-5">
                <summary className="flex cursor-pointer items-center justify-between gap-6 text-[17px] font-semibold">
                  {q}
                  <Plus size={20} className="faq-icon shrink-0 text-muted transition-transform" aria-hidden />
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-night text-white">
        <div className="hero-dots absolute inset-0" aria-hidden />
        <Container className="relative flex flex-col items-start justify-between gap-6 py-16 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-4xl">Get it done by a real person.</h2>
            <p className="mt-2 max-w-xl text-white/70">Post your task in two minutes. {price} flat, protected by escrow, delivered on time.</p>
          </div>
          <LinkButton href={postHref} variant="seal" size="lg" className="px-7">
            Post a task
          </LinkButton>
        </Container>
      </section>
    </>
  );
}
