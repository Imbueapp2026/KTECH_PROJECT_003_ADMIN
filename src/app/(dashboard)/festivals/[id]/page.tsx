"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProductGrid } from "@/components/products/ProductGrid";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Festival, ProductJoined } from "@/lib/data/types";

type FestivalProduct = ProductJoined & { source: 'offer' | 'manual' };

export default function FestivalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [festival, setFestival] = useState<Festival | null>(null);
  const [products, setProducts] = useState<FestivalProduct[]>([]);
  const [offerProducts, setOfferProducts] = useState<ProductJoined[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'offer'>('manual');

  async function loadData() {
    if (!params.id) return;
    try {
      const [festivalRes, productsRes, offersRes] = await Promise.all([
        api.get<{ data: Festival }>(`/api/admin/festivals/${params.id}`),
        api.get<{ data: FestivalProduct[] }>(`/api/admin/festivals/${params.id}/products`),
        api.get<{ data: ProductJoined[] }>("/api/admin/products"),
      ]);

      setFestival(festivalRes.data);
      setProducts(productsRes.data || []);

      const offerProducts = offersRes.data?.filter(
        (p) => p.offer_id && p.festival_id !== params.id,
      ) || [];
      setOfferProducts(offerProducts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load festival data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!params.id) return;

    async function load() {
      try {
        const [festivalRes, productsRes, offersRes] = await Promise.all([
          api.get<{ data: Festival }>(`/api/admin/festivals/${params.id}`),
          api.get<{ data: FestivalProduct[] }>(`/api/admin/festivals/${params.id}/products`),
          api.get<{ data: ProductJoined[] }>("/api/admin/products"),
        ]);
        if (!active) return;
        setFestival(festivalRes.data);
        setProducts(productsRes.data || []);
        const offerProducts = offersRes.data?.filter(
          (p) => p.offer_id && p.festival_id !== params.id,
        ) || [];
        setOfferProducts(offerProducts);
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : "Failed to load festival data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [params.id]);

  async function addProductToFestival(productId: string) {
    try {
      await api.post(`/api/admin/festivals/${params.id}/products`, { product_id: productId });
      push("Product added to festival.", "success");
      loadData();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to add product.", "danger");
    }
  }

  if (loading) {
    return (
      <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !festival) {
    return (
      <div className="p-5 md:p-8 max-w-6xl">
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)] mb-4"
        >
          ← Back to Festivals
        </button>
        <p className="text-sm text-[var(--color-error)]">{error || "Festival not found"}</p>
      </div>
    );
  }

  const manualProducts = products.filter(p => p.source === 'manual');
  const offerBasedProducts = products.filter(p => p.source === 'offer');

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.back()}
            className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)]"
          >
            ← Back to Festivals
          </button>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            {festival.name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={festival.is_active ? "success" : "neutral"}>
              {festival.is_active ? "Active" : "Inactive"}
            </Badge>
            {festival.start_date && festival.end_date && (
              <span className="text-sm text-[var(--color-tertiary)]">
                {new Date(festival.start_date).toLocaleDateString()} - {new Date(festival.end_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={() => router.push(`/festivals/${festival.id}/edit`)}
        >
          Edit Festival
        </Button>
      </header>

      {festival.description && (
        <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] p-5">
          <p className="text-sm text-[var(--color-ink-soft)]">{festival.description}</p>
        </div>
      )}

      {/* Product Management Tabs */}
      <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)]">
        <div className="border-b border-[var(--color-tertiary-soft)]">
          <nav className="flex gap-4 px-5">
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-[var(--color-quaternary)] text-[var(--color-quaternary)]'
                  : 'border-transparent text-[var(--color-tertiary)] hover:text-[var(--color-ink)]'
              }`}
            >
              Manual Products ({manualProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('offer')}
              className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'offer'
                  ? 'border-[var(--color-quaternary)] text-[var(--color-quaternary)]'
                  : 'border-transparent text-[var(--color-tertiary)] hover:text-[var(--color-ink)]'
              }`}
            >
              From Offers ({offerBasedProducts.length})
            </button>
          </nav>
        </div>

        <div className="p-5">
          {activeTab === 'manual' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--color-tertiary)]">
                  Products manually added to this festival
                </p>
              </div>
              {manualProducts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)]">
                  <p className="text-sm text-[var(--color-tertiary)]">No manual products in this festival</p>
                </div>
              ) : (
                <ProductGrid
                  products={manualProducts}
                  hrefBase={(pid) => `/products/${pid}`}
                  emptyTitle="No products"
                  emptyDescription=""
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--color-tertiary)]">
                  Products in this festival that have active offers
                </p>
              </div>
              {offerBasedProducts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)]">
                  <p className="text-sm text-[var(--color-tertiary)]">No offer-based products in this festival</p>
                </div>
              ) : (
                <ProductGrid
                  products={offerBasedProducts}
                  hrefBase={(pid) => `/products/${pid}`}
                  emptyTitle="No products"
                  emptyDescription=""
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Products from Offers Section */}
      <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)]">
        <div className="p-5 border-b border-[var(--color-tertiary-soft)]">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Add Products from Offers
          </h2>
          <p className="text-sm text-[var(--color-tertiary)] mt-1">
            Products with active offers that are not yet in this festival
          </p>
        </div>
        <div className="p-5">
          {offerProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--color-tertiary)]">
                No offer products available to add
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offerProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-[var(--color-tertiary)]">
                      {product.offer?.label}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addProductToFestival(product.id)}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}