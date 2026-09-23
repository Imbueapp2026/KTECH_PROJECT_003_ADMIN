"use client";
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[var(--color-tertiary)]/15 rounded-[var(--radius-sm)] ${className}`}
    />
  );
}