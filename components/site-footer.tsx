import Link from "next/link";
import { Logo } from "@/components/logo";

const COLUMNS = [
  {
    title: "Services",
    links: [
      ["/#services", "IT & software projects"],
      ["/#services", "Essay & content writing"],
      ["/#services", "Book writing & publishing"],
      ["/#services", "UI/UX & graphic design"],
      ["/#proof", "AI & plagiarism reports"],
    ],
  },
  {
    title: "Company",
    links: [
      ["/#how-it-works", "How it works"],
      ["/#pricing", "Pricing"],
      ["/#trust", "Human-made guarantee"],
      ["/#faq", "FAQ"],
    ],
  },
  {
    title: "Account",
    links: [
      ["/login", "Client log in"],
      ["/signup", "Create an account"],
      ["/login?role=expert", "Expert log in"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/terms", "Terms of use"],
      ["/privacy", "Privacy policy"],
      ["/terms#no-ai-pledge", "No-AI pledge"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-thread bg-white">
      <div className="mx-auto grid max-w-content gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">Real work by real people. Zero AI. IT projects, essays and books, delivered on time and protected by escrow.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className="text-sm">
            <p className="font-semibold">{col.title}</p>
            <ul className="mt-3 space-y-2 text-muted">
              {col.links.map(([href, label]) => (
                <li key={label}>
                  <Link className="hover:text-ink" href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-thread">
        <div className="mx-auto flex max-w-content flex-col gap-1 px-4 py-4 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} ZeroAI Hub. Based in the United States.</p>
          <p>Card payments in US dollars, processed by Paystack.</p>
        </div>
      </div>
    </footer>
  );
}
