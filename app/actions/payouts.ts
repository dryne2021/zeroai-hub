"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { dollarsToCents, formatMoney, normalizePhone } from "@/lib/format";
import { PAYOUT_METHOD_LABEL, type ActionResult, type ExpertProfile, type PayoutMethod } from "@/lib/types";
import { payoutDestination } from "@/lib/payouts";
import { adminPath } from "@/lib/admin-path";

async function availableBalance(expertId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("expert_earnings").select("*").eq("expert_id", expertId).maybeSingle();
  if (!data) return 0;
  return data.earned - data.paid_out - data.pending_payouts;
}

export async function requestPayout(input: { amount: string; method: PayoutMethod }): Promise<ActionResult> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from("expert_profiles").select("*").eq("user_id", user.id).maybeSingle();
  const profile = data as ExpertProfile | null;
  if (!profile || profile.status !== "approved") return { ok: false, error: "Only active experts can withdraw." };
  if (!(input.method in PAYOUT_METHOD_LABEL)) return { ok: false, error: "Choose how you want to be paid." };

  const amount = dollarsToCents(input.amount);
  const { min_withdrawal } = await getSettings();
  if (!Number.isFinite(amount) || amount < min_withdrawal) return { ok: false, error: `The minimum withdrawal is ${formatMoney(min_withdrawal)}.` };

  const destination = payoutDestination(profile, input.method);
  if (!destination) return { ok: false, error: `Add your ${PAYOUT_METHOD_LABEL[input.method]} details under payout details first.` };

  if ((await availableBalance(user.id)) < amount) return { ok: false, error: "That's more than your available balance." };
  const { data: payout, error } = await admin
    .from("payouts")
    .insert({ expert_id: user.id, amount, method: input.method, destination })
    .select("id")
    .single();
  if (error || !payout) return { ok: false, error: error?.message || "Could not request the payout." };
  // Guard against two requests racing past the balance check.
  if ((await availableBalance(user.id)) < 0) {
    await admin.from("payouts").delete().eq("id", payout.id);
    return { ok: false, error: "That's more than your available balance." };
  }

  const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
  await Promise.all(
    (admins ?? []).map((a) =>
      notify({ userId: a.id, type: "payout", title: `Payout request: ${formatMoney(amount)}`, link: adminPath("/payouts"), email: false }),
    ),
  );
  revalidatePath("/expert/earnings");
  return { ok: true, message: `Withdrawal of ${formatMoney(amount)} requested.` };
}

const detailsSchema = z.object({
  bank_name: z.string().trim().max(120),
  bank_account_name: z.string().trim().max(120),
  bank_account_number: z.string().trim().max(64),
  bank_swift: z.string().trim().max(20),
  bank_country: z.string().trim().max(60),
  wise_email: z.union([z.literal(""), z.string().trim().email("Enter a valid Wise email address.")]),
  payoneer_email: z.union([z.literal(""), z.string().trim().email("Enter a valid Payoneer email address.")]),
  mpesa_phone: z.string().trim().max(20),
});

export async function savePayoutDetails(input: z.input<typeof detailsSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const phone = d.mpesa_phone ? normalizePhone(d.mpesa_phone) : null;
  if (d.mpesa_phone && !phone) return { ok: false, error: "Enter a valid phone number with its country code." };
  const empty = (v: string) => v || null;
  const { error } = await createAdminClient()
    .from("expert_profiles")
    .update({
      bank_name: empty(d.bank_name),
      bank_account_name: empty(d.bank_account_name),
      bank_account_number: empty(d.bank_account_number),
      bank_swift: empty(d.bank_swift.toUpperCase()),
      bank_country: empty(d.bank_country),
      wise_email: empty(d.wise_email),
      payoneer_email: empty(d.payoneer_email),
      mpesa_phone: phone,
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/expert/earnings");
  return { ok: true, message: "Payout details saved." };
}
