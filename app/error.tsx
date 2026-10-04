"use client";

import { Button, Container } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="max-w-xl py-24 text-center">
      <h1 className="text-3xl font-bold">This page didn&apos;t load</h1>
      <p className="mt-2 text-muted">Try again. If it keeps happening, share this code with support: {error.digest ?? "unknown"}.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </Container>
  );
}
