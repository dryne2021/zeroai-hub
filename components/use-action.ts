"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

/** Runs a server action, shows the result as a toast and refreshes server data on success. */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult | void>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res && !res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        if (res?.message) toast.success(res.message);
        onSuccess?.();
        if (res?.redirect) router.push(res.redirect);
        else router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setError(msg);
        toast.error(msg);
      }
    });
  }
  return { run, pending, error };
}
