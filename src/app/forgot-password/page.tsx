"use client";
import Link from "next/link";
import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/index";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    
    // Client-side email validation
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    
    setError(null);
    setBusy(true);
    try {
      await resetPassword(trimmed);
      setSent(true);
      setCooldown(60); // 60-second cooldown
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[var(--color-surface-muted)] relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[var(--color-secondary-soft)] opacity-50 blur-3xl"
      />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-modal)] p-8 flex flex-col gap-5"
      >
        <div className="flex items-center gap-2 pb-1">
          <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-quaternary)]" />
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-ink-soft)]">
            Avirat Admin
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Reset password
          </h1>
          <p className="text-sm text-[var(--color-tertiary)]">
            We&apos;ll email you instructions to reset.
          </p>
        </div>
        <div className="h-px bg-[var(--color-tertiary-soft)]" />
        {sent ? (
          <div className="bg-[var(--color-success-soft)] border border-[var(--color-success)]/30 rounded-[var(--radius-md)] px-4 py-3">
            <p className="text-sm text-[var(--color-success)] font-medium">
              Check your inbox.
            </p>
            <p className="text-xs text-[var(--color-ink-soft)] mt-1">
              If an account exists for that email, we&apos;ve sent reset instructions.
            </p>
            {cooldown > 0 && (
              <p className="text-xs text-[var(--color-ink-soft)] mt-2">
                You can request another email in {cooldown} seconds.
              </p>
            )}
          </div>
        ) : (
          <>
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <p
                className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-3 py-2"
                role="alert"
              >
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || cooldown > 0} className="w-full">
              {busy ? "Sending…" : cooldown > 0 ? `Wait ${cooldown}s` : "Send reset email"}
            </Button>
          </>
        )}
        <div className="text-xs text-[var(--color-tertiary)] pt-1">
          <Link href="/login" className="text-[var(--color-quaternary)] font-medium hover:underline focus-ring">
            Back to sign in
          </Link>
        </div>
      </form>
    </main>
  );
}