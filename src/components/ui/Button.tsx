"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center font-medium transition-all duration-100 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed focus-ring select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-quaternary)] text-[var(--color-primary)] border border-[var(--color-quaternary)] shadow-[0_1px_2px_rgba(176,141,87,0.25)] hover:bg-[var(--color-quaternary)]/90 hover:border-[var(--color-quaternary)] hover:shadow-[0_2px_4px_rgba(176,141,87,0.3)]",
  secondary:
    "bg-[var(--color-primary)] text-[var(--color-ink)] border border-[var(--color-tertiary-soft)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-tertiary)]",
  danger:
    "bg-[var(--color-error)] text-[var(--color-primary)] border border-[var(--color-error)] hover:bg-[var(--color-error)]/90 hover:border-[var(--color-error)]",
  outline:
    "bg-transparent text-[var(--color-quaternary)] border border-[var(--color-quaternary)] hover:bg-[var(--color-quaternary-soft)]",
  ghost:
    "bg-transparent text-[var(--color-ink-soft)] border border-transparent hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className = "", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} rounded-[var(--radius-sm)] ${className}`}
        {...props}
      />
    );
  },
);