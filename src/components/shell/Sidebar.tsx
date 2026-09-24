"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/lib/auth/index";
import { api, ApiError } from "@/lib/api";
import {
  CategoriesIcon,
  DashboardIcon,
  FestivalIcon,
  InquiryIcon,
  OffersIcon,
  ProductsIcon,
} from "@/components/icons/Tabs";
import type { Inquiry } from "@/lib/data/types";

const tabs = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/products", label: "Products", Icon: ProductsIcon },
  { href: "/inquiries", label: "Inquiry", Icon: InquiryIcon },
  { href: "/categories", label: "Categories", Icon: CategoriesIcon },
  { href: "/offers", label: "Offers and Discount", Icon: OffersIcon },
  { href: "/festivals", label: "Festivals", Icon: FestivalIcon },
] as const;

export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
  onToggle,
}: {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [newCount, setNewCount] = useState<number | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;

    async function fetchCount() {
      if (cancelled) return;
      try {
        const res = await api.get<{ data: Inquiry[] }>("/api/admin/inquiries?status=new");
        if (!cancelled) setNewCount(res.data.length);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setNewCount(null);
          return;
        }
        setNewCount(0);
      }
    }

    fetchCount();
    intervalId = setInterval(fetchCount, 30000); // Poll every 30 seconds

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-black/25 md:hidden"
        />
      )}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col bg-[var(--color-primary)] shadow-xl transition-transform duration-200 ease-out md:relative md:inset-auto md:z-auto md:min-h-screen md:translate-x-0 md:shadow-[1px_0_0_rgba(26,24,22,0.04)] md:transition-[width] ${mobileOpen ? "translate-x-0" : ""} ${collapsed ? "md:w-16" : "md:w-64"}`}>
      <div className={`hidden md:flex border-b border-[var(--color-tertiary-soft)] ${collapsed ? "items-center justify-center px-2 py-4" : "items-center justify-between px-6 pt-6 pb-5"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-quaternary)]"
          />
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)]">
            Avirat Admin
          </p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-tertiary)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)] focus-ring"
        >
          <span className="flex w-4 flex-col gap-1" aria-hidden="true">
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
          </span>
        </button>
      </div>
      <nav className={`flex w-full flex-col overflow-y-auto py-2 gap-1 md:overflow-visible ${collapsed ? "px-1.5" : "px-2"}`}>
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href) ?? false;
          const showBadge = href === "/inquiries" && newCount && newCount > 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`group relative flex items-center gap-3 py-2.5 text-sm font-medium rounded-[var(--radius-md)] border border-transparent transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] focus-ring ${collapsed ? "justify-center px-1.5" : "px-3"} ${
                active
                  ? "bg-[var(--color-secondary-soft)] text-[var(--color-ink)] border-[var(--color-secondary)]/30"
                  : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] transition-transform duration-100 ease-[cubic-bezier(0.4,0,0.2,1)] motion-safe:group-hover:scale-[1.08] ${
                  active
                    ? "bg-[var(--color-secondary)] text-[var(--color-primary)]"
                    : "bg-[var(--color-surface-sunken)] text-[var(--color-tertiary)] group-hover:bg-[var(--color-secondary)] group-hover:text-[var(--color-primary)]"
                }`}
              >
                <Icon />
              </span>
              {!collapsed && <span className="truncate">{label}</span>}
              {showBadge && (
                <Badge tone="new" className="ml-auto">
                  {!collapsed && newCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <div className={`hidden md:block mt-auto border-t border-[var(--color-tertiary-soft)] bg-[var(--color-surface-muted)]/40 ${collapsed ? "p-2" : "p-5"}`}>
        {!collapsed && <>
        <p className="text-xs font-medium text-[var(--color-ink)] truncate">
          {user?.displayName || user?.email || "Not signed in"}
        </p>
        {user?.email && user.displayName && (
          <p className="text-[11px] text-[var(--color-tertiary)] truncate">
            {user.email}
          </p>
        )}
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error-soft)] px-2 py-1 -mx-2 rounded-[var(--radius-sm)] transition-colors focus-ring"
        >
          Sign out
        </button>
        <ConfirmDialog
          open={confirmLogout}
          title="Sign out?"
          description="You'll need to sign in again to access the dashboard."
          confirmLabel="Sign out"
          destructive={true}
          onConfirm={async () => {
            await signOut();
            setConfirmLogout(false);
          }}
          onCancel={() => setConfirmLogout(false)}
        />
        </>}
      </div>
    </aside>
    </>
  );
}