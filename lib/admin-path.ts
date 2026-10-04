/** The admin area lives at /admin. Kept as a helper so links stay in one place. */
export function adminSlug(): string {
  return "admin";
}

export function adminPath(sub = ""): string {
  return `/admin${sub}`;
}
