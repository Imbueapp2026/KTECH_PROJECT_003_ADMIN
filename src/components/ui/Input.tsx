"use client";
import { forwardRef, type InputHTMLAttributes, useState, useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = "", onBlur, id, ...props },
  ref,
) {
  const [touched, setTouched] = useState(false);
  const showError = touched && Boolean(error);
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)]">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        onBlur={(e) => {
          setTouched(true);
          onBlur?.(e);
        }}
        className={`h-10 px-3 bg-[var(--color-primary)] border ${
          showError
            ? "border-[var(--color-error)] bg-[var(--color-error-soft)]/30"
            : "border-[var(--color-tertiary-soft)]"
        } rounded-[var(--radius-sm)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-tertiary)] transition-colors focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20 focus-ring ${className}`}
        aria-invalid={showError}
        aria-describedby={
          showError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        {...props}
      />
      {showError && (
        <span
          id={`${inputId}-error`}
          className="text-xs text-[var(--color-error)] font-medium"
        >
          {error}
        </span>
      )}
      {!showError && hint && (
        <span
          id={`${inputId}-hint`}
          className="text-xs text-[var(--color-tertiary)]"
        >
          {hint}
        </span>
      )}
    </label>
  );
});