"use client";
import { usePathname } from "next/navigation";

const titles: Record<string, { label: string; section: string }> = {
  "/": { label: "Overview", section: "Dashboard" },
  "/products": { label: "Products", section: "Catalog" },
  "/products/new": { label: "Add Product", section: "Catalog" },
  "/inquiries": { label: "Inquiry", section: "Conversations" },
  "/categories": { label: "Categories", section: "Organization" },
  "/offers": { label: "Offers and Discount", section: "Promotions" },
  "/festivals": { label: "Festivals", section: "Promotions" },
  "/festivals/new": { label: "Add Festival", section: "Promotions" },
};

export function MobileTopbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname() ?? "";
  const match = Object.entries(titles).find(([prefix]) =>
    pathname === prefix || pathname.startsWith(prefix + "/"),
  )?.[1];
  if (!match) return null;
  return (
    <div className="md:hidden px-4 py-3 bg-[var(--color-primary)] border-b border-[var(--color-tertiary-soft)] flex items-center gap-3">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation menu"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-surface-sunken)] focus-ring"
      >
        <span className="flex w-5 flex-col gap-1" aria-hidden="true">
          <span className="h-px w-full bg-current" />
          <span className="h-px w-full bg-current" />
          <span className="h-px w-full bg-current" />
        </span>
      </button>
      <span
        aria-hidden
        className="inline-block w-2 h-2 rounded-full bg-[var(--color-quaternary)]"
      />
      <div className="flex flex-col">
        <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] leading-none">
          {match.section}
        </p>
        <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)] leading-tight">
          {match.label}
        </p>
      </div>
    </div>
  );
}