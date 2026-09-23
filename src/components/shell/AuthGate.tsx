"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/index";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-muted)] px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-tertiary-soft)] border-t-[var(--color-quaternary)]" />
          <p className="text-sm font-medium text-[var(--color-ink-soft)]">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-muted)] px-6">
        <div className="text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}