"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { ProductGrid, ProductGridSkeleton } from "@/components/products/ProductGrid";
import { Badge } from "@/components/ui/Badge";
import type {
  Category,
  OfferWithDiscounts,
  ProductJoined,
  Product,
} from "@/lib/data/types";

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<ProductJoined[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const [cat, prod, off] = await Promise.all([
          api.get<Category>(`/api/admin/categories/${id}`),
          api.get<Product[]>(`/api/admin/products?category_id=${id}`),
          api.get<OfferWithDiscounts[]>("/api/admin/offers"),
        ]);
        if (cancelled) return;
        const categoryData = (Array.isArray(cat) ? cat[0] : (cat as unknown as { data?: Category })?.data || cat) as Category;
        const productsData = (Array.isArray(prod) ? prod : (prod as unknown as { data?: Product[] })?.data || prod) as Product[];
        const offersData = (Array.isArray(off) ? off : (off as unknown as { data?: OfferWithDiscounts[] })?.data || off) as OfferWithDiscounts[];
        
        setCategory(categoryData);
        const offerById = new Map(
          offersData.map((o: OfferWithDiscounts) => [o.id, { ...o, discount: o.discounts?.[0] ?? null }]),
        );
        setProducts(
          productsData.map((row: Product) => ({
            ...row,
            category: categoryData,
            offer: row.offer_id ? (offerById.get(row.offer_id) ?? null) : null,
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
  }, [id]);

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
      <Link
        href="/categories"
        className="text-xs font-medium text-[var(--color-tertiary)] hover:text-[var(--color-ink)] focus-ring self-start"
      >
        ← Back to categories
      </Link>
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            Category
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            {category?.name ?? "Category"}
          </h1>
        </div>
        {products && <Badge tone="neutral">{products.length} products</Badge>}
      </header>

      {error && (
        <p
          className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3"
          role="alert"
        >
          {error}
        </p>
      )}

      {products === null ? (
        <ProductGridSkeleton count={4} />
      ) : (
        <ProductGrid
          products={products}
          hrefBase={(pid) => `/products/${pid}`}
          emptyTitle="No products in this category"
          emptyDescription="Assign a product to this category to see it here."
        />
      )}
    </div>
  );
}