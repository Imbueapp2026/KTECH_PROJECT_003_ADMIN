"use client";
import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "new" | "gold";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-soft)] border border-[var(--color-tertiary-soft)]",
  info: "bg-[var(--color-secondary-soft)] text-[var(--color-ink)] border border-[var(--color-secondary)]/30",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/30",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/30",
  danger: "bg-[var(--color-error-soft)] text-[var(--color-error)] border border-[var(--color-error)]/30",
  new: "bg-[var(--color-secondary)] text-[var(--color-primary)] border border-[var(--color-secondary)]",
  gold: "bg-[var(--color-quaternary-soft)] text-[var(--color-quaternary)] border border-[var(--color-quaternary)]/40",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center h-5 px-2 text-[10px] uppercase tracking-[0.06em] font-semibold rounded-[var(--radius-sm)] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}