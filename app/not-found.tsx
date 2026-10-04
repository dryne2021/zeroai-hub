import { Container, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="max-w-xl py-24 text-center">
      <h1 className="text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">The link may be old, or you may not have access to this task.</p>
      <LinkButton href="/dashboard" className="mt-6">Go to your dashboard</LinkButton>
    </Container>
  );
}
