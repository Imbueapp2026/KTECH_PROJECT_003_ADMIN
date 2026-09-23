"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import type { Category } from "@/lib/data/types";

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ data: Category[] }>("/api/admin/categories");
        if (!cancelled) setItems(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load.");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            Organization
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Categories
          </h1>
        </div>
        {items && (
          <Badge tone="neutral">{items.length} total</Badge>
        )}
      </header>

      {error && (
        <p
          className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3"
          role="alert"
        >
          {error}
        </p>
      )}

      {items === null ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[var(--color-primary)] border border-dashed border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] py-16 text-center">
          <p className="text-sm text-[var(--color-tertiary)]">No categories yet.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/categories/${c.id}`}
                className="group block bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5 transition-all duration-150 hover:border-[var(--color-quaternary)]/40 hover:shadow-[var(--shadow-modal)] focus-ring"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    aria-hidden
                    className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-secondary-soft)] flex items-center justify-center text-[var(--color-secondary)]"
                  >
                    <span className="text-xs font-semibold">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--color-ink)] truncate">
                  {c.name}
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mt-1">
                  View products →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}