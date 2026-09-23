"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Festival } from "@/lib/data/types";

export default function FestivalsPage() {
  const { push } = useToast();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    loadFestivals();
  }, []);

  async function loadFestivals() {
    try {
      const res = await api.get<{ data?: Festival[] } | Festival[]>("/api/admin/festivals");
      setFestivals(Array.isArray(res) ? res : res?.data || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load festivals.");
      setFestivals([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/api/admin/festivals/${id}`);
      push("Festival ended successfully. Products have been unlinked.", "success");
      loadFestivals();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to end festival.", "danger");
    } finally {
      setDeletingId(null);
      setConfirmOpen(false);
    }
  }

  function formatDateRange(festival: Festival): string {
    if (festival.start_date && festival.end_date) {
      const start = new Date(festival.start_date);
      const end = new Date(festival.end_date);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
    return festival.date || "—";
  }

  function isCurrentlyActive(festival: Festival): boolean {
    if (!festival.is_active) return false;
    if (festival.start_date && festival.end_date) {
      const now = new Date();
      const start = new Date(festival.start_date);
      const end = new Date(festival.end_date);
      return now >= start && now <= end;
    }
    return true;
  }

  if (loading) {
    return (
      <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            Promotions
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Festivals
          </h1>
        </div>
        <Link
          href="/festivals/new"
          className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-quaternary)] text-[var(--color-primary)] border border-[var(--color-quaternary)]/30 hover:bg-[var(--color-quaternary)]/90 hover:border-[var(--color-quaternary)] focus-ring"
        >
          Add Festival
        </Link>
      </header>

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3" role="alert">
          {error}
        </p>
      )}

      {festivals.filter(festival => isCurrentlyActive(festival)).length === 0 ? (
        <div className="bg-[var(--color-primary)] border border-dashed border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] py-16 text-center">
          <p className="text-sm text-[var(--color-tertiary)]">No active festivals. Create your first festival to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {festivals.filter(festival => isCurrentlyActive(festival)).map((festival) => (
            <div
              key={festival.id}
              className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] overflow-hidden"
            >
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-base font-semibold text-[var(--color-ink)]">
                      {festival.name}
                    </h2>
                    <Badge
                      tone={isCurrentlyActive(festival) ? "success" : "neutral"}
                    >
                      {isCurrentlyActive(festival) ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {festival.description && (
                    <p className="text-sm text-[var(--color-ink-soft)] mb-2 line-clamp-2">
                      {festival.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-[var(--color-tertiary)]">
                    <span>
                      {formatDateRange(festival)}
                    </span>
                    {festival.image_url && (
                      <span className="text-xs">Has image</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/festivals/${festival.id}`}
                    className="inline-flex items-center justify-center h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--color-secondary-soft)] text-[var(--color-ink)] border border-[var(--color-secondary)]/30 hover:bg-[var(--color-secondary)] hover:border-[var(--color-secondary)] focus-ring"
                  >
                    Manage
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeletingId(festival.id);
                      setConfirmOpen(true);
                    }}
                    disabled={deletingId === festival.id}
                  >
                    {deletingId === festival.id ? "Ending..." : "End"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show archived/inactive festivals section */}
      {festivals.filter(festival => !isCurrentlyActive(festival)).length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--color-tertiary)] mb-4">Archived Festivals</h2>
          <div className="grid gap-4">
            {festivals.filter(festival => !isCurrentlyActive(festival)).map((festival) => (
              <div
                key={festival.id}
                className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] overflow-hidden opacity-60"
              >
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-base font-semibold text-[var(--color-ink)]">
                        {festival.name}
                      </h2>
                      <Badge tone="neutral">
                        Inactive
                      </Badge>
                    </div>
                    {festival.description && (
                      <p className="text-sm text-[var(--color-ink-soft)] mb-2 line-clamp-2">
                        {festival.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-[var(--color-tertiary)]">
                      <span>
                        {formatDateRange(festival)}
                      </span>
                      {festival.image_url && (
                        <span className="text-xs">Has image</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/festivals/${festival.id}`}
                      className="inline-flex items-center justify-center h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--color-secondary-soft)] text-[var(--color-ink)] border border-[var(--color-secondary)]/30 hover:bg-[var(--color-secondary)] hover:border-[var(--color-secondary)] focus-ring"
                    >
                      Manage
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeletingId(festival.id);
                        setConfirmOpen(true);
                      }}
                      disabled={deletingId === festival.id}
                    >
                      {deletingId === festival.id ? "Ending..." : "End"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="End this festival?"
        description="This will remove the festival tag from all products but will not affect their offer status. The festival will be marked as inactive."
        confirmLabel="End Festival"
        destructive
        onConfirm={() => {
          if (deletingId) handleDelete(deletingId);
        }}
        onCancel={() => {
          setConfirmOpen(false);
          setDeletingId(null);
        }}
      />
    </div>
  );
}
