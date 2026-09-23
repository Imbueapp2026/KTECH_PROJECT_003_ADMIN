"use client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/index";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function friendlyAuthError(err: unknown): string {
  if (!(err instanceof Error)) return "Sign-in failed. Please try again.";
  const msg = err.message;
  
  // Log the actual error for debugging
  console.error("[login] Auth error:", msg);
  
  if (msg.includes("Firebase not configured") || msg.includes("Firebase auth client is not initialized")) {
    return msg;
  }
  if (msg.includes("auth/wrong-password") || msg.includes("auth/user-not-found")) {
    return "Incorrect email or password.";
  }
  if (msg.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait a few minutes.";
  }
  if (msg.includes("auth/network-request-failed")) {
    return "Network error. Check your internet connection.";
  }
  if (msg.includes("auth/invalid-credential")) {
    return "Incorrect email or password.";
  }
  if (msg.includes("auth/invalid-email")) {
    return "Invalid email address.";
  }
  return msg || "Sign-in failed. Please try again.";
}


import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const expired = searchParams.get("expired") === "1";
  const [error, setError] = useState<string | null>(() =>
    expired ? "Your session has expired. Please sign in again." : null
  );
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
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
          Sign in
        </h1>
        <p className="text-sm text-[var(--color-tertiary)]">
          Access the catalog and inquiries.
        </p>
      </div>
      <div className="h-px bg-[var(--color-tertiary-soft)]" />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p
          className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-3 py-2"
          role="alert"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-end text-xs text-[var(--color-tertiary)] pt-1">
        <Link
          href="/forgot-password"
          className="hover:text-[var(--color-ink)] focus-ring"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[var(--color-surface-muted)] relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[var(--color-secondary-soft)] opacity-50 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[var(--color-quaternary-soft)] opacity-40 blur-3xl"
      />
      <Suspense fallback={<div className="w-full max-w-md h-96 bg-[var(--color-primary)] rounded-[var(--radius-md)] animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
