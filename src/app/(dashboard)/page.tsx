"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Product, Offer, Inquiry } from "@/lib/data/types";

interface MetalPriceData {
  price_per_gram: number | null;
  updated_at: string | null;
  source: string | null;
  fallback?: boolean;
  recalculation_failed?: boolean;
  recalculation_error?: string | null;
  previous_price?: number | null;
  price_decrease_percent?: number | null;
  recalculation_result?: Record<string, unknown>;
  skipped_count?: number;
  skipped_products?: Array<{ id: string; name?: string; reason?: string }>;
  updated_count?: number;
}

interface MissingDataProduct {
  id: string;
  name: string;
  missingFields: string[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    products: number;
    offers: number;
    inquiries: number;
    newInquiries: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Gold price state
  const [goldPrice, setGoldPrice] = useState<MetalPriceData | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [loadingGoldPrice, setLoadingGoldPrice] = useState(true);

  // Silver price state
  const [silverPrice, setSilverPrice] = useState<MetalPriceData | null>(null);
  const [showManualSilverInput, setShowManualSilverInput] = useState(false);
  const [manualSilverPrice, setManualSilverPrice] = useState("");
  const [loadingSilverPrice, setLoadingSilverPrice] = useState(true);

  const [missingDataProducts, setMissingDataProducts] = useState<MissingDataProduct[]>([]);
  const [loadingMissingData, setLoadingMissingData] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prodRes, offerRes, inqRes, goldRes, silverRes, missingDataRes] = await Promise.all([
          api.get<{ data: Product[] }>("/api/admin/products"),
          api.get<{ data: Offer[] }>("/api/admin/offers"),
          api.get<{ data: Inquiry[] }>("/api/admin/inquiries"),
          api.get<MetalPriceData>("/api/admin/gold-price").catch(() => ({
            price_per_gram: null,
            updated_at: null,
            source: null
          })),
          api.get<MetalPriceData>("/api/admin/silver-price").catch(() => ({
            price_per_gram: null,
            updated_at: null,
            source: null
          })),
          api.get<{ count: number; products: MissingDataProduct[] }>("/api/admin/products/missing-data").catch(() => ({ count: 0, products: [] })),
        ]);
        if (cancelled) return;
        setStats({
          products: prodRes.data.length,
          offers: offerRes.data.length,
          inquiries: inqRes.data.length,
          newInquiries: inqRes.data.filter((i) => i.status === "new").length,
        });
        setGoldPrice(goldRes);
        setSilverPrice(silverRes);
        setMissingDataProducts(missingDataRes.products || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load stats.");
        }
      } finally {
        if (!cancelled) {
          setLoadingGoldPrice(false);
          setLoadingSilverPrice(false);
          setLoadingMissingData(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleManualPriceSubmit = async () => {
    const price = parseFloat(manualPrice);
    if (isNaN(price) || price <= 0) {
      setError("Please enter a valid price");
      return;
    }

    try {
      const result = await api.post<MetalPriceData>("/api/admin/gold-price", {
        price_per_gram: price,
        source: "manual"
      });
      
      if (result.price_decrease_percent && result.price_decrease_percent > 20) {
        setError(`Warning: Gold price decreased by ${result.price_decrease_percent.toFixed(1)}% from ₹${result.previous_price} to ₹${result.price_per_gram}/gram. Product prices have been updated.`);
      } else if (result.recalculation_failed) {
        setError(`Gold price updated but price recalculation failed: ${result.recalculation_error || 'Unknown error'}`);
      } else {
        setError(null);
        if (result.skipped_count && result.skipped_count > 0) {
          setError(`Gold price recalculation completed. Updated ${result.updated_count} products. ${result.skipped_count} products were skipped due to missing data.`);
          const missingDataRes = await api.get<{ count: number; products: MissingDataProduct[] }>("/api/admin/products/missing-data");
          setMissingDataProducts(missingDataRes.products || []);
        } else {
          setError(`Gold price recalculation completed. Updated ${result.updated_count} products.`);
        }
      }
      
      const updated = await api.get<MetalPriceData>("/api/admin/gold-price");
      setGoldPrice(updated);
      setShowManualInput(false);
      setManualPrice("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update gold price");
    }
  };

  const handleFetchExternal = async () => {
    try {
      setLoadingGoldPrice(true);
      const updated = await api.post<MetalPriceData>("/api/admin/gold-price/fetch-external");
      
      if (updated.recalculation_failed) {
        setError(`Gold price updated but price recalculation failed: ${updated.recalculation_error || 'Unknown error'}`);
      } else {
        setError(null);
        if (updated.skipped_count && updated.skipped_count > 0) {
          setError(`Gold price updated. ${updated.skipped_count} products were skipped due to missing data.`);
          const missingDataRes = await api.get<{ count: number; products: MissingDataProduct[] }>("/api/admin/products/missing-data");
          setMissingDataProducts(missingDataRes.products || []);
        }
      }
      
      setGoldPrice(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to fetch gold price");
    } finally {
      setLoadingGoldPrice(false);
    }
  };

  const handleManualSilverPriceSubmit = async () => {
    const price = parseFloat(manualSilverPrice);
    if (isNaN(price) || price <= 0) {
      setError("Please enter a valid silver price");
      return;
    }

    try {
      const result = await api.post<MetalPriceData>("/api/admin/silver-price", {
        price_per_gram: price,
        source: "manual"
      });
      
      if (result.price_decrease_percent && result.price_decrease_percent > 20) {
        setError(`Warning: Silver price decreased by ${result.price_decrease_percent.toFixed(1)}% from ₹${result.previous_price} to ₹${result.price_per_gram}/gram. Product prices have been updated.`);
      } else if (result.recalculation_failed) {
        setError(`Silver price updated but price recalculation failed: ${result.recalculation_error || 'Unknown error'}`);
      } else {
        setError(null);
        if (result.skipped_count && result.skipped_count > 0) {
          setError(`Silver price recalculation completed. Updated ${result.updated_count} products. ${result.skipped_count} products were skipped due to missing data.`);
          const missingDataRes = await api.get<{ count: number; products: MissingDataProduct[] }>("/api/admin/products/missing-data");
          setMissingDataProducts(missingDataRes.products || []);
        } else {
          setError(`Silver price recalculation completed. Updated ${result.updated_count} products.`);
        }
      }
      
      const updated = await api.get<MetalPriceData>("/api/admin/silver-price");
      setSilverPrice(updated);
      setShowManualSilverInput(false);
      setManualSilverPrice("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update silver price");
    }
  };

  const handleFetchExternalSilver = async () => {
    try {
      setLoadingSilverPrice(true);
      const updated = await api.post<MetalPriceData>("/api/admin/silver-price/fetch-external");
      
      if (updated.recalculation_failed) {
        setError(`Silver price updated but price recalculation failed: ${updated.recalculation_error || 'Unknown error'}`);
      } else {
        setError(null);
        if (updated.skipped_count && updated.skipped_count > 0) {
          setError(`Silver price updated. ${updated.skipped_count} products were skipped due to missing data.`);
          const missingDataRes = await api.get<{ count: number; products: MissingDataProduct[] }>("/api/admin/products/missing-data");
          setMissingDataProducts(missingDataRes.products || []);
        }
      }
      
      setSilverPrice(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to fetch silver price");
    } finally {
      setLoadingSilverPrice(false);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            Overview
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Dashboard
          </h1>
        </div>
      </header>

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3" role="alert">
          {error}
        </p>
      )}

      {/* Missing Data Alert */}
      {!loadingMissingData && missingDataProducts.length > 0 && (
        <div className="bg-[var(--color-secondary-soft)]/40 border border-[var(--color-secondary)]/30 rounded-[var(--radius-md)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-secondary)] mb-2">
                {missingDataProducts.length} product{missingDataProducts.length !== 1 ? 's' : ''} missing gold/silver pricing data
              </p>
              <p className="text-xs text-[var(--color-ink)] mb-3">
                These products cannot be repriced automatically. Please fill in the missing fields:
              </p>
              <div className="space-y-2">
                {missingDataProducts.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}/edit`}
                    className="block text-xs text-[var(--color-ink)] hover:text-[var(--color-secondary)] transition-colors"
                  >
                    • {product.name} (missing: {product.missingFields.join(", ")})
                  </Link>
                ))}
                {missingDataProducts.length > 5 && (
                  <p className="text-xs text-[var(--color-tertiary)]">
                    ...and {missingDataProducts.length - 5} more
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center justify-center h-8 px-3 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--color-secondary)] text-[var(--color-primary)] hover:opacity-90 transition-opacity"
            >
              Review All
            </Link>
          </div>
        </div>
      )}

      {/* Metal Prices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gold Price Section */}
        <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Live Gold Price</h2>
            <div className="flex gap-2">
              <button
                onClick={handleFetchExternal}
                disabled={loadingGoldPrice}
                className="inline-flex items-center justify-center h-8 px-3 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--color-quaternary)] text-[var(--color-primary)] hover:opacity-90 transition-opacity focus-ring disabled:opacity-50"
              >
                {loadingGoldPrice ? "Fetching..." : "Fetch Live Price"}
              </button>
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="inline-flex items-center justify-center h-8 px-3 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--color-primary)] text-[var(--color-ink)] border border-[var(--color-tertiary-soft)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-tertiary)] focus-ring"
              >
                {showManualInput ? "Cancel" : "Manual Override"}
              </button>
            </div>
          </div>

          {showManualInput && (
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="Enter gold price per gram (₹)"
                className="flex-1 h-10 px-3 rounded-[var(--radius-sm)] text-sm bg-[var(--color-surface-muted)] border border-[var(--color-tertiary-soft)] focus:outline-none focus:border-[var(--color-quaternary)]"
              />
              <button
                onClick={handleManualPriceSubmit}
                className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--color-quaternary)] text-[var(--color-primary)] hover:opacity-90 transition-opacity focus-ring"
              >
                Set Price
              </button>
            </div>
          )}

          {loadingGoldPrice && goldPrice === null ? (
            <Skeleton className="h-12" />
          ) : goldPrice && goldPrice.price_per_gram ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-3xl font-semibold text-[var(--color-ink)]">
                  ₹{goldPrice.price_per_gram.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[var(--color-tertiary)] mt-1">
                  per gram • updated {formatTimeAgo(goldPrice.updated_at)}
                  {goldPrice.fallback && " (cached)"}
                </p>
              </div>
              <Badge tone={goldPrice.source === 'api' ? 'success' : 'neutral'}>
                {goldPrice.source === 'api' ? 'Live' : 'Manual'}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-tertiary)]">No gold price set. Click &quot;Fetch Live Price&quot; or use manual override.</p>
          )}
        </div>

        {/* Silver Price Section */}
        <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Live Silver Price</h2>
            <div className="flex gap-2">
              <button
                onClick={handleFetchExternalSilver}
                disabled={loadingSilverPrice}
                className="inline-flex items-center justify-center h-8 px-3 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--color-quaternary)] text-[var(--color-primary)] hover:opacity-90 transition-opacity focus-ring disabled:opacity-50"
              >
                {loadingSilverPrice ? "Fetching..." : "Fetch Live Price"}
              </button>
              <button
                onClick={() => setShowManualSilverInput(!showManualSilverInput)}
                className="inline-flex items-center justify-center h-8 px-3 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--color-primary)] text-[var(--color-ink)] border border-[var(--color-tertiary-soft)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-tertiary)] focus-ring"
              >
                {showManualSilverInput ? "Cancel" : "Manual Override"}
              </button>
            </div>
          </div>

          {showManualSilverInput && (
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                value={manualSilverPrice}
                onChange={(e) => setManualSilverPrice(e.target.value)}
                placeholder="Enter silver price per gram (₹)"
                className="flex-1 h-10 px-3 rounded-[var(--radius-sm)] text-sm bg-[var(--color-surface-muted)] border border-[var(--color-tertiary-soft)] focus:outline-none focus:border-[var(--color-quaternary)]"
              />
              <button
                onClick={handleManualSilverPriceSubmit}
                className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--color-quaternary)] text-[var(--color-primary)] hover:opacity-90 transition-opacity focus-ring"
              >
                Set Price
              </button>
            </div>
          )}

          {loadingSilverPrice && silverPrice === null ? (
            <Skeleton className="h-12" />
          ) : silverPrice && silverPrice.price_per_gram ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-3xl font-semibold text-[var(--color-ink)]">
                  ₹{silverPrice.price_per_gram.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[var(--color-tertiary)] mt-1">
                  per gram • updated {formatTimeAgo(silverPrice.updated_at)}
                  {silverPrice.fallback && " (cached)"}
                </p>
              </div>
              <Badge tone={silverPrice.source === 'api' ? 'success' : 'neutral'}>
                {silverPrice.source === 'api' ? 'Live' : 'Manual'}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-tertiary)]">No silver price set. Click &quot;Fetch Live Price&quot; or use manual override.</p>
          )}
        </div>
      </div>

      {stats === null ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/products"
            className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5 hover:border-[var(--color-quaternary)]/40 hover:shadow-[var(--shadow-modal)] transition-all focus-ring"
          >
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-2">
              Products
            </p>
            <p className="text-3xl font-semibold text-[var(--color-ink)]">{stats.products}</p>
          </Link>

          <Link
            href="/offers"
            className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5 hover:border-[var(--color-quaternary)]/40 hover:shadow-[var(--shadow-modal)] transition-all focus-ring"
          >
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-2">
              Offers
            </p>
            <p className="text-3xl font-semibold text-[var(--color-ink)]">{stats.offers}</p>
          </Link>

          <Link
            href="/inquiries"
            className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5 hover:border-[var(--color-quaternary)]/40 hover:shadow-[var(--shadow-modal)] transition-all focus-ring"
          >
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-2">
              Inquiries
            </p>
            <p className="text-3xl font-semibold text-[var(--color-ink)]">{stats.inquiries}</p>
          </Link>

          <Link
            href="/inquiries"
            className="bg-[var(--color-secondary-soft)]/40 border border-[var(--color-secondary)]/30 rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-5 hover:border-[var(--color-secondary)]/60 hover:shadow-[var(--shadow-modal)] transition-all focus-ring"
          >
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-secondary)] mb-2">
              New Inquiries
            </p>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-semibold text-[var(--color-ink)]">{stats.newInquiries}</p>
              {stats.newInquiries > 0 && <Badge tone="new">New</Badge>}
            </div>
          </Link>
        </div>
      )}

      <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] p-6">
        <h2 className="text-base font-semibold text-[var(--color-ink)] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/products/new"
            className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-quaternary)] text-[var(--color-primary)] hover:opacity-90 transition-opacity focus-ring"
          >
            Add Product
          </Link>
          <Link
            href="/categories/new"
            className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-primary)] text-[var(--color-ink)] border border-[var(--color-tertiary-soft)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-tertiary)] focus-ring"
          >
            Add Category
          </Link>
          <Link
            href="/offers/new"
            className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-primary)] text-[var(--color-ink)] border border-[var(--color-tertiary-soft)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-tertiary)] focus-ring"
          >
            Add Offer
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-primary)] text-[var(--color-ink)] border border-[var(--color-tertiary-soft)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-tertiary)] focus-ring"
          >
            Manage Categories
          </Link>
        </div>
      </div>
    </div>
  );
}
