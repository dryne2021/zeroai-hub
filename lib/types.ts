export type Role = "client" | "expert" | "admin";
export type ExpertStatus = "pending" | "approved" | "rejected" | "suspended";
export type TaskStatus =
  | "draft" | "open" | "quoted" | "funded" | "in_progress" | "delivered" | "revision" | "completed" | "disputed" | "cancelled";
export type FileKind = "brief" | "draft" | "final" | "report";
export type PayoutMethod = "bank" | "wise" | "payoneer" | "mpesa";
export type EscrowStatus = "pending" | "held" | "released" | "refunded";

export interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  is_banned: boolean;
  banned_reason: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  is_active: boolean;
  sort_order: number;
}

export interface Settings {
  task_price: number;
  fee_percent: number;
  min_withdrawal: number;
  auto_accept_days: number;
  revisions_included: number;
}

export interface ExpertProfile {
  user_id: string;
  headline: string;
  bio: string;
  skills: string[];
  category_ids: string[];
  portfolio_links: string[];
  portfolio_files: { path: string; name: string; size: number }[];
  years_experience: number;
  location: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_swift: string | null;
  bank_country: string | null;
  wise_email: string | null;
  payoneer_email: string | null;
  mpesa_phone: string | null;
  pledge_signed_at: string | null;
  onboarded_at: string | null;
  created_by: string | null;
  status: ExpertStatus;
  review_note: string | null;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface Task {
  id: string;
  client_id: string;
  category_id: string;
  title: string;
  description: string;
  deadline: string;
  budget_min: number | null;
  budget_max: number | null;
  status: TaskStatus;
  coursework_confirmed: boolean;
  expert_id: string | null;
  accepted_quote_id: string | null;
  revisions_included: number;
  revisions_used: number;
  status_before_dispute: TaskStatus | null;
  published_at: string | null;
  funded_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  auto_accepted: boolean;
  ai_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskFile {
  id: string;
  task_id: string;
  uploader_id: string;
  kind: FileKind;
  version: number;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  preview_path: string | null;
  preview_status: "none" | "ready" | "unavailable";
  note: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  task_id: string;
  expert_id: string;
  price: number;
  delivery_date: string;
  note: string;
  assigned_by_admin: boolean;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  created_at: string;
}

export interface Order {
  id: string;
  task_id: string;
  quote_id: string;
  client_id: string;
  expert_id: string;
  amount: number;
  fee_percent: number;
  fee_amount: number;
  expert_amount: number;
  escrow_status: EscrowStatus;
  payment_method: "card" | null;
  currency: string;
  payment_status: "unpaid" | "initiated" | "success" | "failed";
  provider_reference: string | null;
  receipt_number: string | null;
  refund_amount: number;
  paid_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  task_id: string;
  expert_id: string;
  sender_id: string;
  body: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  was_masked: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  task_id: string;
  order_id: string;
  opened_by: string;
  reason: string;
  details: string;
  status: "open" | "resolved";
  resolution: "refund" | "partial_refund" | "release" | null;
  refund_amount: number | null;
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  expert_id: string;
  amount: number;
  method: PayoutMethod;
  destination: string;
  status: "requested" | "processing" | "paid" | "rejected";
  provider_reference: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  headline: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  expert_status: ExpertStatus | null;
}

export type ActionResult = { ok: true; message?: string; redirect?: string } | { ok: false; error: string };

export const PAYOUT_METHOD_LABEL: Record<PayoutMethod, string> = {
  bank: "Bank transfer (ACH or wire)",
  wise: "Wise",
  payoneer: "Payoneer",
  mpesa: "M-Pesa (Kenya)",
};
