"use client";
import { useEffect, useState, useMemo } from "react";
import { api, ApiError } from "@/lib/api";
import { ProductGrid, ProductGridSkeleton } from "@/components/products/ProductGrid";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import type { Category, OfferWithDiscounts, ProductJoined, Product } from "@/lib/data/types";

export default function ProductsPage() {
  const [allProducts, setAllProducts] = useState<ProductJoined[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [p, c, o] = await Promise.all([
          api.get<{ data: Product[] }>("/api/admin/products"),
          api.get<{ data: Category[] }>("/api/admin/categories"),
          api.get<{ data: OfferWithDiscounts[] }>("/api/admin/offers"),
        ]);
        if (cancelled) return;
        const catById = new Map(c.data.map((x) => [x.id, x]));
        const offerById = new Map(
          o.data.map((x) => [x.id, { ...x, discount: x.discounts?.[0] ?? null }]),
        );
        const joined = p.data.map((row) => ({
          ...row,
          category: catById.get(row.category_id) ?? null,
          offer: row.offer_id ? (offerById.get(row.offer_id) ?? null) : null,
        }));
        setAllProducts(joined);
        setCategories(c.data);
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

  const products = useMemo(() => {
    if (!allProducts) return null;

    let filtered = [...allProducts];

    if (searchQuery) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category_id === categoryFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (availabilityFilter !== "all") {
      filtered = filtered.filter((p) => p.availability === availabilityFilter);
    }

    return filtered;
  }, [allProducts, searchQuery, categoryFilter, statusFilter, availabilityFilter]);

  const totalPages = products ? Math.max(1, Math.ceil(products.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = products ? products.slice((currentPage - 1) * pageSize, currentPage * pageSize) : [];

  const published = allProducts?.filter((p) => p.status === "published").length ?? 0;
  const draft = allProducts?.filter((p) => p.status === "draft").length ?? 0;
  const onSale = allProducts?.filter((p) => p.offer_id).length ?? 0;

  return (
    <div className="p-5 md:p-8 flex flex-col gap-6 max-w-6xl">
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            Catalog
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Products
          </h1>
        </div>
        {products && (
          <div className="flex items-center gap-2">
            <Badge tone="success">{published} published</Badge>
            <Badge tone="neutral">{draft} draft</Badge>
            <Badge tone="gold">{onSale} on sale</Badge>
          </div>
        )}
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          label="Search products"
          name="search"
          type="search"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="md:w-64"
        />
        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)]">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus-ring"
            >
              <option value="all">All categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus-ring"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)]">
              Availability
            </label>
            <select
              value={availabilityFilter}
              onChange={(e) => {
                setAvailabilityFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus-ring"
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="made_to_order">Made to order</option>
              <option value="sold_out">Sold out</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3" role="alert">
          {error}
        </p>
      )}

      {products === null ? (
        <ProductGridSkeleton count={8} />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-[var(--color-tertiary)] gap-3 flex-wrap">
            <span>
              {products.length} {products.length === 1 ? "product" : "products"} found
            </span>
            {(searchQuery || categoryFilter !== "all" || statusFilter !== "all" || availabilityFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setStatusFilter("all");
                  setAvailabilityFilter("all");
                }}
                className="text-[var(--color-quaternary)] hover:underline focus-ring"
              >
                Clear filters
              </button>
            )}
          </div>
          {products.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-[var(--radius-md)] border border-[var(--color-tertiary-soft)] bg-[var(--color-primary)] px-3 py-2">
              <span className="text-xs text-[var(--color-tertiary)]">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 text-xs rounded-[var(--radius-sm)] border border-[var(--color-tertiary-soft)] bg-[var(--color-primary)] text-[var(--color-ink)] disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-3 text-xs rounded-[var(--radius-sm)] border border-[var(--color-tertiary-soft)] bg-[var(--color-primary)] text-[var(--color-ink)] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          <ProductGrid
            products={pagedProducts}
            hrefBase={(id) => `/products/${id}`}
            emptyTitle="No products found"
            emptyDescription="Try adjusting your search or filters."
          />
        </>
      )}
    </div>
  );
}