"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface AnalyticsData {
  overview: {
    totalProducts: number;
    publishedProducts: number;
    draftProducts: number;
    archivedProducts: number;
    totalOffers: number;
    activeOffers: number;
    totalInquiries: number;
    newInquiries: number;
    contactedInquiries: number;
    resolvedInquiries: number;
    hallmarkCertified: number;
    avgPrice: number;
    availableProducts: number;
    madeToOrderProducts: number;
    soldOutProducts: number;
  };
  visits: {
    totalVisits: number;
    uniquePages: number;
    topPages: Array<{ page_path: string; count: number }>;
    popularProducts: Array<{ product_id: string; count: number; product_name?: string }>;
  };
  trends: {
    dailyVisits: Array<{ date: string; count: number }>;
    weeklyVisits: Array<{ week: string; count: number }>;
    monthlyVisits: Array<{ month: string; count: number }>;
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7d");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await api.get<{ data: AnalyticsData }>(`/api/admin/analytics?period=${period}`);
        if (cancelled) return;
        setData(response.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load analytics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const stats = data?.overview;

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            Insights
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Analytics
          </h1>
        </div>
        <div className="flex gap-2">
          {["7d", "30d", "90d"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                period === p
                  ? "bg-[var(--color-quaternary)] text-white border-[var(--color-quaternary)]"
                  : "bg-[var(--color-primary)] text-[var(--color-ink)] border-[var(--color-tertiary-soft)] hover:border-[var(--color-quaternary)]"
              }`}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : stats ? (
        <div className="flex flex-col gap-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-2">
                Total Products
              </p>
              <p className="text-3xl font-semibold text-[var(--color-ink)]">{stats.totalProducts}</p>
              <p className="text-xs text-[var(--color-tertiary)] mt-1">
                {stats.publishedProducts} published
              </p>
            </div>

            <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-2">
                Active Offers
              </p>
              <p className="text-3xl font-semibold text-[var(--color-ink)]">{stats.activeOffers}</p>
              <p className="text-xs text-[var(--color-tertiary)] mt-1">
                of {stats.totalOffers} total
              </p>
            </div>

            <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-2">
                Inquiries
              </p>
              <p className="text-3xl font-semibold text-[var(--color-ink)]">{stats.totalInquiries}</p>
              <p className="text-xs text-[var(--color-tertiary)] mt-1">
                {stats.newInquiries} new
              </p>
            </div>

            <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-2">
                Avg Price
              </p>
              <p className="text-3xl font-semibold text-[var(--color-ink)]">
                ₹{Math.round(stats.avgPrice).toLocaleString()}
              </p>
              <p className="text-xs text-[var(--color-tertiary)] mt-1">
                per product
              </p>
            </div>
          </div>

          {/* Product Status Breakdown */}
          <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-6">
            <h2 className="text-base font-semibold text-[var(--color-ink)] mb-4">Product Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-ink)]">Published</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--color-success)] rounded-full"
                      style={{ width: `${(stats.publishedProducts / stats.totalProducts) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-ink)] w-12 text-right">
                    {stats.publishedProducts}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-ink)]">Draft</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--color-surface-muted)] rounded-full"
                      style={{ width: `${(stats.draftProducts / stats.totalProducts) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-ink)] w-12 text-right">
                    {stats.draftProducts}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-ink)]">Archived</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--color-error)] rounded-full"
                      style={{ width: `${(stats.archivedProducts / stats.totalProducts) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-ink)] w-12 text-right">
                    {stats.archivedProducts}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Availability Breakdown */}
          <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-6">
            <h2 className="text-base font-semibold text-[var(--color-ink)] mb-4">Product Availability</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-[var(--color-surface-muted)] rounded-[var(--radius-md)]">
                <p className="text-2xl font-semibold text-[var(--color-ink)]">{stats.availableProducts}</p>
                <p className="text-xs text-[var(--color-tertiary)] mt-1">Available</p>
              </div>
              <div className="text-center p-4 bg-[var(--color-surface-muted)] rounded-[var(--radius-md)]">
                <p className="text-2xl font-semibold text-[var(--color-ink)]">{stats.madeToOrderProducts}</p>
                <p className="text-xs text-[var(--color-tertiary)] mt-1">Made to Order</p>
              </div>
              <div className="text-center p-4 bg-[var(--color-surface-muted)] rounded-[var(--radius-md)]">
                <p className="text-2xl font-semibold text-[var(--color-ink)]">{stats.soldOutProducts}</p>
                <p className="text-xs text-[var(--color-tertiary)] mt-1">Sold Out</p>
              </div>
            </div>
          </div>

          {/* Inquiry Status */}
          <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-6">
            <h2 className="text-base font-semibold text-[var(--color-ink)] mb-4">Inquiry Status</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--color-ink)]">New</span>
                  <Badge tone="new">{stats.newInquiries}</Badge>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--color-ink)]">Contacted</span>
                  <Badge tone="info">{stats.contactedInquiries}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-ink)]">Resolved</span>
                  <Badge tone="neutral">{stats.resolvedInquiries}</Badge>
                </div>
              </div>
              <div className="text-center p-4 bg-[var(--color-secondary-soft)]/40 rounded-[var(--radius-md)]">
                <p className="text-3xl font-semibold text-[var(--color-ink)]">{stats.totalInquiries}</p>
                <p className="text-xs text-[var(--color-tertiary)] mt-1">Total</p>
              </div>
            </div>
          </div>

          {/* Hallmark Certification */}
          <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-6">
            <h2 className="text-base font-semibold text-[var(--color-ink)] mb-4">Hallmark Certification</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-ink)]">Certified Products</span>
                  <span className="text-sm font-medium text-[var(--color-ink)]">
                    {stats.hallmarkCertified} / {stats.totalProducts}
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-[var(--color-quaternary)] rounded-full"
                    style={{ width: `${(stats.hallmarkCertified / stats.totalProducts) * 100}%` }}
                  />
                </div>
              </div>
              <Badge tone="gold">
                {stats.totalProducts > 0
                  ? Math.round((stats.hallmarkCertified / stats.totalProducts) * 100)
                  : 0}% certified
              </Badge>
            </div>
          </div>

          {/* Visit Analytics */}
          {data && (
            <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-6">
              <h2 className="text-base font-semibold text-[var(--color-ink)] mb-4">Visit Analytics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-[var(--color-surface-muted)] rounded-[var(--radius-md)]">
                  <p className="text-2xl font-semibold text-[var(--color-ink)]">{data.visits.totalVisits}</p>
                  <p className="text-xs text-[var(--color-tertiary)] mt-1">Total Visits</p>
                </div>
                <div className="text-center p-4 bg-[var(--color-surface-muted)] rounded-[var(--radius-md)]">
                  <p className="text-2xl font-semibold text-[var(--color-ink)]">{data.visits.uniquePages}</p>
                  <p className="text-xs text-[var(--color-tertiary)] mt-1">Unique Pages</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-ink)] mb-3">Top Pages</h3>
                  <div className="space-y-2">
                    {data.visits.topPages.slice(0, 5).map((page, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-ink)] truncate max-w-[200px]" title={page.page_path}>
                          {page.page_path}
                        </span>
                        <span className="text-[var(--color-tertiary)] font-medium">{page.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-ink)] mb-3">Popular Products</h3>
                  <div className="space-y-2">
                    {data.visits.popularProducts.map((product, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-ink)] truncate max-w-[200px]" title={product.product_name}>
                          {product.product_name || "Unknown"}
                        </span>
                        <span className="text-[var(--color-tertiary)] font-medium">{product.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
