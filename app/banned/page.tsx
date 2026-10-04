import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/actions/account";
import { Button, Container } from "@/components/ui";

export default async function BannedPage() {
  const user = await getCurrentUser();
  return (
    <Container className="max-w-xl py-20">
      <h1 className="text-3xl font-bold">Your account is suspended</h1>
      <p className="mt-3 text-muted">
        {user?.profile.banned_reason ? `Reason: ${user.profile.banned_reason}. ` : ""}If you think this is a mistake, reply to any email from ZeroAI Hub and our team will review it.
      </p>
      <form action={signOut} className="mt-6">
        <Button variant="secondary">Sign out</Button>
      </form>
    </Container>
  );
}
