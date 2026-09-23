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

export function MobileTopbar() {
  const pathname = usePathname() ?? "";
  const match = Object.entries(titles).find(([prefix]) =>
    pathname === prefix || pathname.startsWith(prefix + "/"),
  )?.[1];
  if (!match) return null;
  return (
    <div className="md:hidden px-5 py-3 bg-[var(--color-primary)] border-b border-[var(--color-tertiary-soft)] flex items-center gap-2">
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