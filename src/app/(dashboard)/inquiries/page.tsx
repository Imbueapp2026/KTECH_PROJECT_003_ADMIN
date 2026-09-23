"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import type { InquiryStatus, InquiryJoined } from "@/lib/data/types";

const STATUS_TONE: Record<InquiryStatus, "new" | "info" | "neutral"> = {
  new: "new",
  contacted: "info",
  resolved: "neutral",
};

const NEXT_STATUS: Record<InquiryStatus, InquiryStatus | null> = {
  new: "contacted",
  contacted: "resolved",
  resolved: null,
};

const NEXT_LABEL: Record<InquiryStatus, string> = {
  new: "Mark contacted",
  contacted: "Resolve",
  resolved: "",
};

export default function InquiriesPage() {
  const [items, setItems] = useState<InquiryJoined[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ data: InquiryJoined[] }>("/api/admin/inquiries");
        if (!cancelled) setItems(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function transition(row: InquiryJoined) {
    const next = NEXT_STATUS[row.status];
    if (!next) return;
    setBusyId(row.id);
    try {
      await api.patch(`/api/admin/inquiries/${row.id}`, { status: next });
      setItems((prev) =>
        prev
          ? next === "resolved"
            ? prev.filter((r) => r.id !== row.id)
            : prev.map((r) => (r.id === row.id ? { ...r, status: next } : r))
          : prev,
      );
      push(`Inquiry ${next}.`, "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Could not update inquiry.", "danger");
    } finally {
      setBusyId(null);
    }
  }

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const activeItems = items.filter((item) => item.status !== "resolved");
    const next = statusFilter === "all"
      ? activeItems
      : activeItems.filter((item) => item.status === statusFilter);
    return [...next].sort((a, b) =>
      sortOrder === "newest"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [items, statusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const newCount = items?.filter((i) => i.status === "new").length ?? 0;
  const contactedCount = items?.filter((i) => i.status === "contacted").length ?? 0;

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            Conversations
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Inquiry
          </h1>
        </div>
        {items && (
          <div className="flex items-center gap-2">
            <Badge tone="new">{newCount} new</Badge>
            <Badge tone="info">{contactedCount} contacted</Badge>
            <Badge tone="neutral">{items.length - newCount - contactedCount} resolved</Badge>
          </div>
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
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)]">
              Filter by status
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as InquiryStatus | "all");
                  setPage(1);
                }}
                className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus-ring"
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)]">
              Sort by
              <select
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value as "newest" | "oldest");
                  setPage(1);
                }}
                className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus-ring"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              title="No inquiries match this filter"
              description="Try changing the status or reset the list."
            />
          ) : (
            <>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-tertiary-soft)] bg-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-tertiary)]">
                  <span>Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--color-tertiary-soft)] disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--color-tertiary-soft)] disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              <ul className="flex flex-col gap-3">
                {pagedItems.map((row) => {
                  const isNew = row.status === "new";
                  const next = NEXT_STATUS[row.status];
                  return (
                    <li
                      key={row.id}
                      className={`bg-[var(--color-primary)] border rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5 flex flex-col gap-3 transition-colors ${
                        isNew
                          ? "border-[var(--color-secondary)] border-l-[3px]"
                          : "border-[var(--color-tertiary-soft)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-9 w-9 shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-quaternary-soft)] text-[var(--color-quaternary)] flex items-center justify-center text-sm font-semibold">
                            {row.name.trim().slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-[var(--color-ink)] truncate">
                                {row.name}
                              </p>
                              <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                            </div>
                            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-[var(--color-tertiary)]">
                              <a href={`tel:${row.phone}`} className="hover:text-[var(--color-ink)] transition-colors">
                                {row.phone}
                              </a>
                              {row.email && (
                                <a href={`mailto:${row.email}`} className="hover:text-[var(--color-ink)] transition-colors truncate">
                                  {row.email}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {next && (
                            <Button
                              size="sm"
                              variant={row.status === "contacted" ? "danger" : "primary"}
                              onClick={() => transition(row)}
                              disabled={busyId === row.id}
                            >
                              {NEXT_LABEL[row.status]}
                            </Button>
                          )}
                        </div>
                      </div>
                      {row.message && (
                        <div className="bg-[var(--color-surface-muted)] rounded-[var(--radius-sm)] p-3 border border-[var(--color-tertiary-soft)]">
                          <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-1">
                            Message
                          </p>
                          <p className="text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap leading-relaxed">
                            {row.message}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-[var(--color-tertiary)] pt-3 border-t border-[var(--color-tertiary-soft)]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {row.product ? (
                            <div className="flex items-center gap-2">
                              {row.product.image_urls && row.product.image_urls[0] && (
                                <div className="relative h-8 w-8 overflow-hidden rounded">
                                  <Image
                                    src={row.product.image_urls[0]}
                                    alt={row.product.name}
                                    fill
                                    className="object-cover"
                                    sizes="32px"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <span>
                                <span className="text-[var(--color-quaternary)] font-medium">Re:</span>{" "}
                                {row.product.name}
                              </span>
                            </div>
                          ) : (
                            <Badge tone="neutral">General inquiry</Badge>
                          )}
                          {row.source_page && (
                            <span className="text-[var(--color-tertiary)]">from {row.source_page}</span>
                          )}
                        </div>
                        <time dateTime={row.created_at} className="shrink-0">
                          {new Date(row.created_at).toLocaleString()}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}