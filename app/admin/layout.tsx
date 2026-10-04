import { requireAdmin } from "@/lib/auth";
import { adminPath } from "@/lib/admin-path";
import { Container } from "@/components/ui";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Anyone who isn't a signed-in admin gets a plain "page not found", so the address stays secret.
  await requireAdmin();
  return (
    <Container className="py-6 sm:py-8">
      <AdminNav base={adminPath()} />
      <div className="mt-6">{children}</div>
    </Container>
  );
}
