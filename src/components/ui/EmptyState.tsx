"use client";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center bg-[var(--color-primary)] border border-dashed border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)]">
      <div className="w-10 h-10 rounded-full bg-[var(--color-secondary-soft)] flex items-center justify-center">
        <span aria-hidden className="w-2 h-2 rounded-full bg-[var(--color-secondary)]" />
      </div>
      <p className="text-base font-semibold text-[var(--color-ink)]">{title}</p>
      {description && (
        <p className="text-sm text-[var(--color-tertiary)] max-w-md">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}