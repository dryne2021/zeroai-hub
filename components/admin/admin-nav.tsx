"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const ITEMS = [
  ["", "Overview"],
  ["/experts", "Experts"],
  ["/tasks", "Tasks"],
  ["/audits", "AI audits"],
  ["/disputes", "Disputes"],
  ["/payouts", "Payouts"],
  ["/users", "Users"],
  ["/settings", "Settings"],
] as const;

export function AdminNav({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-thread px-4 sm:mx-0 sm:px-0" aria-label="Admin">
      {ITEMS.map(([sub, label]) => {
        const href = base + sub;
        const active = sub === "" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[15px] font-semibold",
              active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
