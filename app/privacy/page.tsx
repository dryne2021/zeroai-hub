import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy policy" };

const UPDATED = "3 October 2026";

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">Privacy policy</h1>
      <p className="mt-2 text-muted">Last updated {UPDATED}</p>

      <div className="mt-8 space-y-10 text-[16px] leading-[1.7]">
        <section>
          <h2 className="mb-3 text-xl font-bold">1. Who we are</h2>
          <p>ZeroAI Hub is a marketplace, based in the United States, that connects clients with human experts. This policy explains what personal data we collect, why, and the choices you have. If you have questions, reply to any email from ZeroAI Hub.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">2. What we collect</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong>Account details:</strong> your name, email address, and your profile picture if you sign in with Google.</li>
            <li><strong>Expert profiles:</strong> the headline, skills and categories our team sets up for experts, and each expert&apos;s signed no-AI pledge.</li>
            <li><strong>Task content:</strong> task briefs, attachments, quotes, drafts, final files, chat messages and ratings.</li>
            <li><strong>Payment records:</strong> amounts, dates and payment references. Card details are entered on Paystack&apos;s page and never reach our servers.</li>
            <li><strong>Payout details:</strong> the bank, Wise, Payoneer or M-Pesa details experts give us so we can pay them.</li>
            <li><strong>Technical data:</strong> sign-in sessions and basic logs needed to keep the service secure.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">3. How we use it</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>To run the marketplace: posting tasks, sending quotes, chat, file delivery, escrow payments, refunds and payouts.</li>
            <li>To send notifications about your tasks by email and inside the site.</li>
            <li>To enforce our terms, including spot audits for AI use and resolving disputes.</li>
            <li>To keep the service secure and prevent fraud.</li>
          </ul>
          <p className="mt-3">We don&apos;t sell your personal data, and we don&apos;t use your files or messages to train AI models.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">4. Who can see it</h2>
          <p>Your files and messages on a task are visible only to you, the other party on that task, and our admins when they handle support, disputes and audits. Experts see a task&apos;s brief only if it&apos;s open in a category they&apos;re approved for. Your name and ratings are shown to the people you work with.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">5. Service providers</h2>
          <p>We use trusted providers to run the service: Supabase (database, sign-in and file storage), Vercel (hosting), Paystack (card payments), Google (optional sign-in) and an email delivery provider. They process data only to provide their service to us.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">6. How long we keep it</h2>
          <p>We keep account and task records while your account is open, and payment records for as long as tax and accounting laws require. When you close your account, we delete or anonymise your personal data unless we must keep it for legal reasons or an open dispute.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">7. Your rights</h2>
          <p>You can ask to see, correct, export or delete your personal data. Depending on where you live, privacy laws such as the California Consumer Privacy Act (CCPA) and, for users in the EU and UK, the GDPR give you further rights, including the right to complain to a data protection authority. We don&apos;t sell or share personal data for targeted advertising. To make a request, reply to any email from ZeroAI Hub.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">8. Security</h2>
          <p>Files are stored in private storage and shared only through short-lived signed links. Access to data is limited by database rules so users see only their own tasks, messages and files.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">9. Changes</h2>
          <p>If we change this policy, we&apos;ll update the date above and tell you about significant changes by email or on the site. See also our <Link href="/terms" className="font-semibold underline underline-offset-4">terms of use</Link>.</p>
        </section>
      </div>
    </Container>
  );
}
