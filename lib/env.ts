function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  // Accepts the classic key names and the names the Vercel Marketplace Supabase integration creates.
  supabaseAnonKey: () =>
    required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  serviceRoleKey: () =>
    required("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  signedUrlSeconds: () => Number(process.env.SIGNED_URL_TTL_SECONDS || 300),
  cronSecret: () => process.env.CRON_SECRET || "",
};
