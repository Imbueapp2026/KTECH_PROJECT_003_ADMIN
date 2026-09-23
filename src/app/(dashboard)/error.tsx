"use client";

import { Button } from "@/components/ui/Button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-5 md:p-8 max-w-3xl">
      <div className="rounded-[var(--radius-md)] border border-[var(--color-error)]/30 bg-[var(--color-error-soft)] px-5 py-6 text-sm text-[var(--color-ink)]">
        <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-error)]">
          Dashboard error
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
          Something went wrong
        </h2>
        <p className="mt-2 text-[var(--color-ink-soft)]">
          {error.message || "The dashboard could not load this section."}
        </p>
        <div className="mt-4">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
