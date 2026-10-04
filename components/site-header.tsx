import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { Avatar, LinkButton } from "@/components/ui";
import { NotificationBell } from "@/components/notification-bell";
import { signOut } from "@/app/actions/account";
import { displayName } from "@/lib/format";

type NavItem = { href: string; label: string };

export async function SiteHeader() {
  const user = await getCurrentUser();
  let unread = 0;
  if (user) {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    unread = count ?? 0;
  }
  const role = user?.profile.role;
  const nav: NavItem[] = !user
    ? [
        { href: "/#services", label: "Services" },
        { href: "/#how-it-works", label: "How it works" },
        { href: "/#pricing", label: "Pricing" },
        { href: "/#faq", label: "FAQ" },
      ]
    : role === "admin"
      ? [
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/tasks", label: "Tasks" },
          { href: "/admin/experts", label: "Experts" },
        ]
      : role === "expert"
        ? [
            { href: "/expert", label: "My work" },
            { href: "/expert/browse", label: "Find tasks" },
            { href: "/expert/earnings", label: "Earnings" },
          ]
        : [
            { href: "/client", label: "My tasks" },
            { href: "/client/orders", label: "Orders & receipts" },
          ];

  return (
    <header className="sticky top-0 z-40 border-b border-thread bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-control px-3 py-2 text-[15px] font-medium text-muted hover:bg-ink-faint hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {role === "client" && (
                <LinkButton href="/tasks/new" size="sm" className="hidden sm:inline-flex">
                  Post a task
                </LinkButton>
              )}
              <NotificationBell userId={user.id} initialUnread={unread} />
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-0.5 hover:bg-ink-faint [&::-webkit-details-marker]:hidden">
                  <Avatar name={user.profile.full_name || user.email} size={34} />
                  <span className="sr-only">Account menu</span>
                </summary>
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-panel border border-thread bg-white py-1 shadow-[0_12px_32px_-12px_rgba(20,33,61,0.25)]">
                  <div className="border-b border-thread px-4 py-3">
                    <p className="truncate font-semibold">{displayName(user.profile.full_name, "Your account")}</p>
                    <p className="truncate text-sm text-muted">{user.email || user.profile.phone}</p>
                  </div>
                  <div className="py-1 md:hidden">
                    {nav.map((item) => (
                      <Link key={item.href} href={item.href} className="block px-4 py-2.5 text-[15px] hover:bg-paper">
                        {item.label}
                      </Link>
                    ))}
                    {role === "client" && (
                      <Link href="/tasks/new" className="block px-4 py-2.5 text-[15px] font-semibold text-seal-dark hover:bg-paper">
                        Post a task
                      </Link>
                    )}
                  </div>
                  <Link href="/notifications" className="flex items-center gap-2 px-4 py-2.5 text-[15px] hover:bg-paper">
                    <Bell size={16} aria-hidden /> Notifications
                  </Link>
                  <Link href="/settings" className="block px-4 py-2.5 text-[15px] hover:bg-paper">
                    Account settings
                  </Link>
                  <form action={signOut}>
                    <button className="block w-full px-4 py-2.5 text-left text-[15px] text-danger hover:bg-paper">Sign out</button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-control px-3 py-2 text-[15px] font-medium text-ink hover:bg-ink-faint sm:inline-block">
                Log in
              </Link>
              <LinkButton href="/signup?next=/tasks/new" size="sm" variant="seal">
                Post a task
              </LinkButton>
              <details className="relative md:hidden">
                <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-control border border-thread [&::-webkit-details-marker]:hidden" aria-label="Menu">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </summary>
                <div className="absolute right-0 mt-2 w-56 rounded-panel border border-thread bg-white py-1 shadow-lg">
                  <Link href="/login" className="block px-4 py-2.5 text-[15px] font-semibold hover:bg-paper">
                    Log in
                  </Link>
                  <Link href="/signup" className="block px-4 py-2.5 text-[15px] hover:bg-paper">
                    Create an account
                  </Link>
                  {nav.map((item) => (
                    <Link key={item.href} href={item.href} className="block px-4 py-2.5 text-[15px] hover:bg-paper">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
