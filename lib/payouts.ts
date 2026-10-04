import type { ExpertProfile, PayoutMethod } from "@/lib/types";

const has = (v: string | null | undefined) => Boolean(v && v.trim());

/** The details an admin needs to send the money, or null when they're missing. */
export function payoutDestination(p: ExpertProfile, method: PayoutMethod): string | null {
  switch (method) {
    case "bank":
      if (!has(p.bank_name) || !has(p.bank_account_name) || !has(p.bank_account_number)) return null;
      return [p.bank_name, p.bank_account_name, p.bank_account_number, p.bank_swift && `Routing/SWIFT ${p.bank_swift}`, p.bank_country]
        .filter(Boolean)
        .join(" / ");
    case "wise":
      return has(p.wise_email) ? p.wise_email : null;
    case "payoneer":
      return has(p.payoneer_email) ? p.payoneer_email : null;
    case "mpesa":
      return has(p.mpesa_phone) ? p.mpesa_phone : null;
  }
}

export function configuredPayoutMethods(p: ExpertProfile): PayoutMethod[] {
  return (["bank", "wise", "payoneer"] as const).filter((m) => payoutDestination(p, m) !== null);
}
