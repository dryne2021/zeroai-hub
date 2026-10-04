import type { EscrowStatus, TaskStatus } from "@/lib/types";

/** The platform charges and pays out in US dollars. Every amount is stored as an integer number of cents. */
export const CURRENCY = "USD";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });

/** Formats cents as dollars, e.g. 2550 -> "$25.50" and 2500 -> "$25". */
export function formatMoney(cents: number | null | undefined) {
  const c = Math.round(cents ?? 0);
  return usd.format(c / 100).replace(/\.00$/, "");
}

/** Parses a dollar amount typed by a user ("25", "25.5", "$1,200.00") into cents. Returns NaN when invalid. */
export function dollarsToCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return NaN;
  const cleaned = String(input).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}

/** Cents to a plain number string for inputs, e.g. 2550 -> "25.50", 2500 -> "25". */
export function centsToInput(cents: number | null | undefined) {
  const c = Math.round(cents ?? 0);
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2);
}

/** Dates render on the server, so times are shown in UTC and labelled as such. */
export function formatDate(value: string | Date | null | undefined, withTime = false) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const text = d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    timeZone: "UTC",
  });
  return withTime ? `${text.replace(",", "")} UTC` : text;
}

export function timeAgo(value: string) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return formatDate(value);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  draft: "Draft",
  open: "Open",
  quoted: "Quoted",
  funded: "Funded",
  in_progress: "In progress",
  delivered: "Delivered",
  revision: "Revision",
  completed: "Completed",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<TaskStatus, "neutral" | "info" | "seal" | "amber" | "danger"> = {
  draft: "neutral",
  open: "info",
  quoted: "info",
  funded: "seal",
  in_progress: "seal",
  delivered: "amber",
  revision: "amber",
  completed: "seal",
  disputed: "danger",
  cancelled: "neutral",
};

/**
 * Normalises a phone number to E.164 ("+14155550123"). A 10-digit number without a country
 * code is treated as a US number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.length === 10) digits = "1" + digits;
    else if (digits.length === 11 && digits.startsWith("1")) digits = digits;
    else return null;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

export function displayName(name: string | null | undefined, fallback = "Member") {
  return name?.trim() || fallback;
}

export function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

export const ESCROW_LABEL: Record<EscrowStatus, { label: string; tone: "neutral" | "info" | "seal" | "amber" | "danger" }> = {
  pending: { label: "Awaiting payment", tone: "neutral" },
  held: { label: "Held in escrow", tone: "info" },
  released: { label: "Released", tone: "seal" },
  refunded: { label: "Refunded", tone: "amber" },
};

