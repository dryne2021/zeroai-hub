import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/public-sans";
import "./globals.css";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "ZeroAI Hub: Real work by real people. Zero AI.", template: "%s | ZeroAI Hub" },
  description:
    "Post a task and get quotes from vetted human experts who sign a no-AI pledge. Writing, design, data, programming and translation, paid by card through escrow.",
  openGraph: { title: "ZeroAI Hub", description: "Real work by real people. Zero AI.", type: "website" },
};

// Every page renders the signed-in header, so render per request.
export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#14213D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
