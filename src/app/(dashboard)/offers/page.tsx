"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProductGrid, ProductGridSkeleton } from "@/components/products/ProductGrid";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type {
  Category,
  Discount,
  OfferWithDiscounts,
  ProductJoined,
  Product,
  Festival,
} from "@/lib/data/types";

function formatDiscount(d: Discount | undefined): string {
  if (!d) return "—";
  return d.discount_type === "percentage"
    ? `${d.value}% off`
    : `₹${d.value} off`;
}

export default function OffersPage() {
  const { push } = useToast();
  const [offers, setOffers] = useState<OfferWithDiscounts[] | null>(null);
  const [products, setProducts] = useState<ProductJoined[] | null>(null);
  const [activeFestival, setActiveFestival] = useState<Festival | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [off, prod, cat, fest] = await Promise.all([
          api.get<{ data: OfferWithDiscounts[] }>("/api/admin/offers"),
          api.get<{ data: Product[] }>("/api/admin/products"),
          api.get<{ data: Category[] }>("/api/admin/categories"),
          api.get<{ data: Festival[] }>("/api/admin/festivals"),
        ]);
        if (cancelled) return;
        setOffers(off.data);
        
        // Get active festival
        const activeFest = fest.data?.find(f => f.is_active);
        setActiveFestival(activeFest || null);
        
        const catById = new Map(cat.data.map((c) => [c.id, c]));
        const offerById = new Map(
          off.data.map((o) => [o.id, { ...o, discount: o.discounts?.[0] ?? null }]),
        );
        setProducts(
          prod.data
            .filter((p) => p.offer_id)
            .map((row) => ({
              ...row,
              category: catById.get(row.category_id) ?? null,
              offer: offerById.get(row.offer_id!) ?? null,
            })),
        );
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

  async function addAllOfferProductsToFestival(offerId: string) {
    if (!activeFestival) {
      push("No active festival to add products to.", "danger");
      return;
    }
    
    const offerProducts = products?.filter(p => p.offer_id === offerId) || [];
    
    if (offerProducts.length === 0) {
      push("No products to add.", "danger");
      return;
    }
    
    try {
      // Add all products in sequence
      for (const product of offerProducts) {
        await api.post(`/api/admin/festivals/${activeFestival.id}/products`, { product_id: product.id });
      }
      push(`Added ${offerProducts.length} products to festival.`, "success");
      window.location.reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to add products to festival.", "danger");
    }
  }

  if (error) {
    return (
      <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Offers and Discount
        </h1>
        <p
          className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3"
          role="alert"
        >
          {error}
        </p>
      </div>
    );
  }

  if (offers === null || products === null) {
    return (
      <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Offers and Discount
        </h1>
        <div className="flex flex-col gap-6 mt-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Offers and Discount
        </h1>
        <div className="bg-[var(--color-primary)] border border-dashed border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] py-16 text-center">
          <p className="text-sm text-[var(--color-tertiary)]">No offers yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            Promotions
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Offers and Discount
          </h1>
          {activeFestival && (
            <p className="text-xs text-[var(--color-tertiary)] mt-1">
              Active festival: {activeFestival.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{offers.length} offers</Badge>
          {activeFestival && (
            <Badge tone="success">Festival Active</Badge>
          )}
        </div>
      </header>

      {offers.map((o) => {
        const inOffer = products.filter((p) => p.offer_id === o.id);
        const d = o.discounts?.[0];
        return (
          <section
            key={o.id}
            className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] overflow-hidden"
          >
            <header className="px-5 py-4 border-b border-[var(--color-tertiary-soft)] bg-[var(--color-quaternary-soft)]/40 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-semibold text-[var(--color-ink)]">
                  {o.label}
                </h2>
                <Badge tone={o.is_active ? "success" : "neutral"}>
                  {o.is_active ? "Active" : "Inactive"}
                </Badge>
                <Badge tone="gold">{formatDiscount(d)}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-tertiary)]">
                  {inOffer.length} {inOffer.length === 1 ? "product" : "products"}
                </span>
                {activeFestival && o.is_active && (
                  <Button
                    size="sm"
                    onClick={() => addAllOfferProductsToFestival(o.id)}
                  >
                    Add All to Festival
                  </Button>
                )}
              </div>
            </header>
            {o.description && (
              <p className="px-5 py-3 text-sm text-[var(--color-ink-soft)] border-b border-[var(--color-tertiary-soft)]">
                {o.description}
              </p>
            )}
            <div className="p-5">
              <ProductGrid
                products={inOffer}
                hrefBase={(pid) => `/products/${pid}`}
                emptyTitle="No products in this offer"
                emptyDescription="Attach products to this offer to see them here."
              />
              {activeFestival && o.is_active && inOffer.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--color-tertiary-soft)] flex items-center justify-between">
                  <p className="text-sm text-[var(--color-tertiary)]">
                    {inOffer.filter(p => !p.festival_id).length} products can be added to {activeFestival.name}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => addAllOfferProductsToFestival(o.id)}
                  >
                    Add All to Festival
                  </Button>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}