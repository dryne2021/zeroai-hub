"use client";

import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button variant="secondary" className="mt-6 print:hidden" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
