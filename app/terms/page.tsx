import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";
import { PLEDGE_POINTS } from "@/lib/pledge";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Terms of use" };

const UPDATED = "3 October 2026";

export default async function TermsPage() {
  const settings = await getSettings().catch(() => null);
  const price = formatMoney(settings?.task_price ?? 2000);
  const fee = settings?.fee_percent ?? 15;
  const sections: { id?: string; title: string; body: React.ReactNode }[] = [
    {
      title: "What ZeroAI Hub is",
      body: (
        <>
          <p>ZeroAI Hub is a marketplace, based in the United States, that connects clients with independent human experts for IT projects, writing, publishing and design work. We hold payments in escrow, provide tools to communicate and deliver files, and resolve disputes. Experts are independent professionals, not our employees.</p>
          <p>By creating an account you agree to these terms. You must be at least 18 years old and able to enter a binding contract where you live.</p>
        </>
      ),
    },
    {
      title: "Accounts",
      body: (
        <>
          <p>Anyone can create a client account. Expert accounts are created by the ZeroAI Hub team, who send each expert their login details privately. Keep your password safe and don&apos;t share your account. You&apos;re responsible for activity on it.</p>
        </>
      ),
    },
    {
      id: "no-ai-pledge",
      title: "The no-AI pledge",
      body: (
        <>
          <p>Every expert signs this pledge before they can work on a task:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            {PLEDGE_POINTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="mt-3">Spelling and grammar checkers that only flag mistakes, and ordinary software such as word processors, design tools, spreadsheets and code editors without AI generation, are allowed.</p>
          <p>We audit a random sample of completed tasks. If we confirm AI use, the client is refunded in full, the expert forfeits the payment and the expert&apos;s account is suspended.</p>
        </>
      ),
    },
    {
      title: "Posting tasks and choosing an expert",
      body: (
        <p>Clients describe the task, may attach files up to 100 MB each, and set a deadline. Vetted experts in that category may offer to take the task on, or the ZeroAI Hub team may assign an expert directly. Paying for a task creates an agreement between the client and the expert for that task.</p>
      ),
    },
    {
      title: "Price, payments and escrow",
      body: (
        <>
          <p>Every task has the same flat price, currently {price}, shown before you pay. Payments are made by card in US dollars through our payment processor, Paystack. Your bank may add its own fees. We hold the payment in escrow until the client accepts the work.</p>
          <p>On acceptance, the expert is credited the price minus the platform fee in force when the task was paid (currently {fee}%). If the client neither accepts nor requests a revision within 5 days of delivery, the work is accepted automatically and payment is released.</p>
          <p>Experts withdraw available earnings to a bank account, Wise or Payoneer once they reach the minimum withdrawal amount, and are responsible for their own taxes and any fees charged to receive the money.</p>
        </>
      ),
    },
    {
      title: "On-time delivery",
      body: (
        <p>Each expert commits to a delivery date before work starts. If work is late, the client can open a dispute while the payment is still in escrow, and we may refund the client in full or in part.</p>
      ),
    },
    {
      title: "Drafts, previews and revisions",
      body: (
        <p>Experts must upload at least one draft before delivering the final file. Before acceptance, clients see a watermarked or partial preview only. Two revisions are included with every task. The full final file is available to download only after acceptance.</p>
      ),
    },
    {
      title: "Communication",
      body: (
        <p>Keep all communication about a task on ZeroAI Hub. Phone numbers, email addresses and messaging links are hidden in chat until a task is paid for. Taking payment for a task outside the platform is not allowed and may lead to a ban. The ZeroAI Hub team may read task conversations and join them to help, resolve disputes and run audits.</p>
      ),
    },
    {
      title: "Disputes and refunds",
      body: (
        <p>Either party can open a dispute while payment is held in escrow. Our team reviews the brief, files and messages and decides on a full refund, a partial refund or release to the expert. Refunds go back to the card used to pay and usually appear within 5 to 10 business days. Our decision on escrowed funds is final, without affecting any rights you have under the law that applies to you.</p>
      ),
    },
    {
      title: "Ownership",
      body: (
        <p>When payment is released, the client owns the final delivered work and may use it for any lawful purpose, unless the client and expert agreed otherwise in chat before payment. Experts may not resell or reuse the delivered work for another client.</p>
      ),
    },
    {
      title: "Acceptable use",
      body: (
        <p>You may not use ZeroAI Hub for anything illegal, harmful, deceptive, defamatory or that infringes someone else&apos;s rights, including plagiarism, fake reviews, impersonation and harassment. We may remove tasks and suspend or ban accounts that break these terms.</p>
      ),
    },
    {
      title: "Privacy",
      body: (
        <p>How we handle personal data is explained in our <Link href="/privacy" className="font-semibold underline underline-offset-4">privacy policy</Link>.</p>
      ),
    },
    {
      title: "Contact",
      body: <p>Questions about these terms? Reply to any email from ZeroAI Hub and our team will get back to you.</p>,
    },
  ];

  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">Terms of use</h1>
      <p className="mt-2 text-muted">Last updated {UPDATED}</p>
      <div className="mt-8 space-y-10 text-[16px] leading-[1.7]">
        {sections.map((s, i) => (
          <section key={s.title} id={s.id} className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold">{i + 1}. {s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </Container>
  );
}
