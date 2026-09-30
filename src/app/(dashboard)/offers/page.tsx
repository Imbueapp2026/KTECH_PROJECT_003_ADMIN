"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProductGrid } from "@/components/products/ProductGrid";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { saveBannerWithFeedback } from "@/lib/offer-banner-ui";
import { formatOfferAssignmentConfirmation, type OfferAssignmentPreview } from "@/lib/offer-assignment-ui";
import type {
  Category,
  Discount,
  OfferWithDiscounts,
  ProductJoined,
  Product,
  Festival,
  OfferBanner,
} from "@/lib/data/types";

type BannerDraft = {
  product_id: string | null;
  alt_text: string;
  is_active: boolean;
  display_order: number;
};

type PendingOfferAssignment = {
  offer: OfferWithDiscounts;
  scope: "all" | "selected";
  productIds: string[] | null;
  preview: OfferAssignmentPreview;
};

async function loadAllAdminProducts(): Promise<Product[]> {
  const first = await api.get<{
    data: Product[];
    pagination: { limit: number; total: number };
  }>("/api/admin/products?limit=100");
  const pageCount = Math.ceil(first.pagination.total / first.pagination.limit);
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      api.get<{ data: Product[] }>(`/api/admin/products?page=${index + 2}&limit=100`),
    ),
  );
  return [first.data, ...remaining.map((page) => page.data)].flat();
}

function formatDiscount(d: Discount | undefined): string {
  if (!d) return "—";
  if (d.discount_type === "making_charge") return `Making charge: ${d.value}%`;
  return (d.discount_type === "percentage" || (d.discount_type as string) === "percent")
    ? `${d.value}% off`
    : `₹${d.value} off`;
}

export default function OffersPage() {
  const { push } = useToast();
  const [offers, setOffers] = useState<OfferWithDiscounts[] | null>(null);
  const [products, setProducts] = useState<ProductJoined[] | null>(null);
  const [activeFestival, setActiveFestival] = useState<Festival | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null);
  const [bulkActionOfferId, setBulkActionOfferId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string[]>>({});
  const [pendingAssignment, setPendingAssignment] = useState<PendingOfferAssignment | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [off, prod, cat, fest] = await Promise.all([
          api.get<{ data: OfferWithDiscounts[] }>("/api/admin/offers"),
          loadAllAdminProducts(),
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
        setProducts(prod.map((row) => ({
          ...row,
          category: catById.get(row.category_id) ?? null,
          offer: row.offer_id ? offerById.get(row.offer_id) ?? null : null,
        })));
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

  async function persistOfferAssignment(pending: PendingOfferAssignment) {
    const path = pending.scope === "all"
      ? `/api/admin/offers/${pending.offer.id}/apply-all`
      : `/api/admin/offers/${pending.offer.id}/apply-selected`;
    const body = pending.scope === "all"
      ? { confirmOverride: true }
      : { productIds: pending.productIds, confirmOverride: true };
    const result = await api.post<{ updated: number }>(path, body);
    push(`Offer applied to ${result.updated} products.`, "success");
    if (pending.scope === "selected") {
      setSelectedProductIds((current) => ({ ...current, [pending.offer.id]: [] }));
    }
    try {
      const refreshed = await loadAllAdminProducts();
      const categoryById = new Map((products ?? []).map((product) => [product.category_id, product.category]));
      const offerById = new Map((offers ?? []).map((offer) => [offer.id, { ...offer, discount: offer.discounts?.[0] ?? null }]));
      setProducts(refreshed.map((row) => ({
        ...row,
        category: categoryById.get(row.category_id) ?? null,
        offer: row.offer_id ? offerById.get(row.offer_id) ?? null : null,
      })));
    } catch {
      push("Offer applied, but the product list could not be refreshed.", "danger");
    }
  }

  async function previewOfferAssignment(
    offer: OfferWithDiscounts,
    scope: "all" | "selected",
    productIds: string[] | null = null,
  ) {
    setBulkActionOfferId(offer.id);
    try {
      const path = scope === "all"
        ? `/api/admin/offers/${offer.id}/apply-all`
        : `/api/admin/offers/${offer.id}/apply-selected`;
      const preview = await api.post<OfferAssignmentPreview>(
        path,
        scope === "all" ? {} : { productIds },
      );
      const pending = { offer, scope, productIds, preview } satisfies PendingOfferAssignment;
      if (scope === "all" || preview.conflicts > 0) setPendingAssignment(pending);
      else await persistOfferAssignment(pending);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to apply offer.", "danger");
    } finally {
      setBulkActionOfferId(null);
    }
  }

  async function confirmPendingAssignment() {
    if (!pendingAssignment || bulkActionOfferId) return;
    setBulkActionOfferId(pendingAssignment.offer.id);
    try {
      await persistOfferAssignment(pendingAssignment);
      setPendingAssignment(null);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to apply offer.", "danger");
    } finally {
      setBulkActionOfferId(null);
    }
  }

  function toggleSelectedProduct(offerId: string, productId: string, checked: boolean) {
    setSelectedProductIds((current) => {
      const next = new Set(current[offerId] ?? []);
      if (checked) next.add(productId);
      else next.delete(productId);
      return { ...current, [offerId]: [...next] };
    });
  }

  async function removeOfferFromAllProducts(offer: OfferWithDiscounts) {
    if (!window.confirm(`Remove "${offer.label}" from ALL products it is currently applied to?`)) return;
    setBulkActionOfferId(offer.id);
    try {
      const res = await api.delete<{ ok: boolean; updated: number }>(`/api/admin/offers/${offer.id}/apply-all`);
      push(`Offer removed from ${res.updated} products.`, "success");
      setProducts((current) =>
        current?.map((p) => p.offer_id === offer.id ? { ...p, offer_id: null, offer: null } : p) ?? null
      );
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to remove offer from all products.", "danger");
    } finally {
      setBulkActionOfferId(null);
    }
  }

  async function addAllOfferProductsToFestival(offerId: string) {
    if (!activeFestival) {
      push("No active festival to add products to.", "danger");
      return;
    }

    // Only add products that are not already in this festival
    const offerProducts = products?.filter(p => p.offer_id === offerId && p.festival_id !== activeFestival.id) || [];

    if (offerProducts.length === 0) {
      push("No products to add, or they are all already in the festival.", "default");
      return;
    }

    try {
      // Parallelize product additions
      await Promise.all(offerProducts.map(product => 
        api.post(`/api/admin/festivals/${activeFestival.id}/products`, { product_id: product.id })
      ));
      
      push(`Added ${offerProducts.length} products to festival.`, "success");
      
      // Update local state without a full page reload
      setProducts(current => current?.map(p => 
        p.offer_id === offerId ? { ...p, festival_id: activeFestival.id } : p
      ) ?? null);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to add products to festival.", "danger");
    }
  }

  async function saveBanner(offer: OfferWithDiscounts, draft: BannerDraft, file: File | null) {
    const formData = new FormData();
    formData.append("product_id", draft.product_id ?? "");
    formData.append("alt_text", draft.alt_text);
    formData.append("is_active", String(draft.is_active));
    formData.append("display_order", String(draft.display_order));
    if (file) formData.append("file", file);

    return saveBannerWithFeedback(
      () => api.putFormData<OfferBanner>(`/api/admin/offers/${offer.id}/banner`, formData),
      (saved) => {
        setOffers((current) => current?.map((item) => item.id === offer.id ? { ...item, offer_banners: [saved] } : item) ?? null);
        push("Offer banner saved.", "success");
      },
      (err) => push(err instanceof ApiError ? err.message : "Failed to save offer banner.", "danger"),
    );
  }

  async function deleteBanner(offerId: string) {
    try {
      await api.delete(`/api/admin/offers/${offerId}/banner`);
      setOffers((current) => current?.map((offer) => offer.id === offerId ? { ...offer, offer_banners: [] } : offer) ?? null);
      push("Offer banner removed.", "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to remove offer banner.", "danger");
    }
  }

  async function deleteOffer(offer: OfferWithDiscounts) {
    if (!window.confirm(`Remove ${offer.label}? Its products will remain available without this offer.`)) return;
    setDeletingOfferId(offer.id);
    try {
      await api.delete(`/api/admin/offers/${offer.id}`);
      setOffers((current) => current?.filter((item) => item.id !== offer.id) ?? null);
      setProducts((current) => current?.map((product) => product.offer_id === offer.id
        ? { ...product, offer_id: null, offer: null }
        : product) ?? null);
      push("Offer removed.", "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to remove offer.", "danger");
    } finally {
      setDeletingOfferId(null);
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--color-tertiary)]">
                  {inOffer.length} {inOffer.length === 1 ? "product" : "products"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={bulkActionOfferId === o.id}
                  onClick={() => void previewOfferAssignment(o, "all")}
                >
                  {bulkActionOfferId === o.id ? "Applying..." : "Apply to All Products"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={bulkActionOfferId === o.id || inOffer.length === 0}
                  onClick={() => void removeOfferFromAllProducts(o)}
                >
                  {bulkActionOfferId === o.id ? "Removing..." : "Remove from All"}
                </Button>
                {activeFestival && o.is_active && (
                  <Button
                    size="sm"
                    onClick={() => addAllOfferProductsToFestival(o.id)}
                  >
                    Add All to Festival
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deletingOfferId === o.id}
                  onClick={() => void deleteOffer(o)}
                >
                  {deletingOfferId === o.id ? "Removing..." : "Remove offer"}
                </Button>
              </div>
            </header>
            {o.description && (
              <p className="px-5 py-3 text-sm text-[var(--color-ink-soft)] border-b border-[var(--color-tertiary-soft)]">
                {o.description}
              </p>
            )}
            <OfferProductSelector
              offer={o}
              products={products}
              selectedIds={selectedProductIds[o.id] ?? []}
              disabled={bulkActionOfferId === o.id}
              onToggle={(productId, checked) => toggleSelectedProduct(o.id, productId, checked)}
              onApply={(productIds) => previewOfferAssignment(o, "selected", productIds)}
            />
            <OfferBannerEditor
              key={`${o.id}-${o.offer_banners?.[0]?.id ?? 'nobanner'}`}
              offer={o}
              products={inOffer.filter((product) => product.status === "published")}
              onSave={saveBanner}
              onDelete={deleteBanner}
            />
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
      <ConfirmDialog
        open={pendingAssignment !== null}
        title={pendingAssignment?.preview.conflicts ? "Replace existing offers?" : "Apply offer?"}
        description={pendingAssignment ? formatOfferAssignmentConfirmation(pendingAssignment.scope, pendingAssignment.offer.label, pendingAssignment.preview) : ""}
        confirmLabel={pendingAssignment?.preview.conflicts ? "Replace offers" : "Apply offer"}
        onConfirm={() => void confirmPendingAssignment()}
        onCancel={() => {
          if (!bulkActionOfferId) setPendingAssignment(null);
        }}
      />
    </div>
  );
}

function OfferProductSelector({
  offer,
  products,
  selectedIds,
  disabled,
  onToggle,
  onApply,
}: {
  offer: OfferWithDiscounts;
  products: ProductJoined[] | null;
  selectedIds: string[];
  disabled: boolean;
  onToggle: (productId: string, checked: boolean) => void;
  onApply: (productIds: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const allProducts = products ?? [];
  const selected = new Set(selectedIds);
  const visible = allProducts
    .filter((product) => product.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 100);

  return (
    <details className="border-b border-[var(--color-tertiary-soft)]">
      <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-[var(--color-ink)]">
        Apply to selected products {selectedIds.length > 0 ? `(${selectedIds.length} selected)` : ""}
      </summary>
      <div className="px-5 pb-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
          aria-label={`Search products to apply ${offer.label} to`}
          className="h-9 w-full max-w-md rounded-[var(--radius-sm)] border border-[var(--color-tertiary-soft)] bg-[var(--color-primary)] px-3 text-sm text-[var(--color-ink)]"
        />
        <div className="mt-3 max-h-64 overflow-y-auto border-y border-[var(--color-tertiary-soft)]">
          {visible.map((product) => {
            const checked = selected.has(product.id);
            const replacesOffer = checked && product.offer_id && product.offer_id !== offer.id;
            return (
              <div key={product.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--color-tertiary-soft)]/60 px-2 py-2 last:border-0">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => onToggle(product.id, event.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-[var(--color-tertiary-soft)] text-[var(--color-quaternary)]"
                  />
                  <span className="truncate">{product.name}</span>
                </label>
                {product.offer && <span className="text-xs text-[var(--color-tertiary)]">{product.offer.label}</span>}
                {replacesOffer && (
                  <p className="basis-full pl-6 text-xs text-[var(--color-error)]" role="status">
                    Currently assigned to {product.offer?.label ?? "another offer"}; selecting this will replace it.
                  </p>
                )}
              </div>
            );
          })}
          {visible.length === 0 && <p className="px-2 py-4 text-sm text-[var(--color-tertiary)]">No products match.</p>}
          {visible.length === 100 && <p className="px-2 py-2 text-xs text-[var(--color-tertiary)]">Refine the search to see more matches.</p>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--color-tertiary)]">{selectedIds.length} selected</span>
          <Button size="sm" disabled={disabled || selectedIds.length === 0} onClick={() => onApply(selectedIds)}>
            Apply to selected
          </Button>
        </div>
      </div>
    </details>
  );
}

function OfferBannerEditor({
  offer,
  products,
  onSave,
  onDelete,
}: {
  offer: OfferWithDiscounts;
  products: ProductJoined[];
  onSave: (offer: OfferWithDiscounts, draft: BannerDraft, file: File | null) => Promise<OfferBanner | null>;
  onDelete: (offerId: string) => Promise<void>;
}) {
  const banner = offer.offer_banners?.[0];
  const [draft, setDraft] = useState<BannerDraft>({
    product_id: banner?.product_id ?? null,
    alt_text: banner?.alt_text ?? `${offer.label} offer`,
    is_active: banner?.is_active ?? true,
    display_order: banner?.display_order ?? 0,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await onSave(offer, draft, selectedFile);
      if (!saved) return;
      setDraft({
        product_id: saved.product_id,
        alt_text: saved.alt_text,
        is_active: saved.is_active,
        display_order: saved.display_order,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
    } finally {
      setSaving(false);
    }
  }

  const imageUrl = previewUrl ?? banner?.image_url;

  return (
    <div className="border-b border-[var(--color-tertiary-soft)] bg-[var(--color-surface-muted)]/30 px-4 py-5 sm:px-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--color-quaternary)]">
            Current offers banner
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--color-ink)]">
            Promote this offer
          </h3>
          <p className="mt-1 text-xs text-[var(--color-tertiary)]">
            Visitors will be sent to the selected product when they tap the banner.
          </p>
        </div>
        {banner && (
          <Button size="sm" variant="ghost" onClick={() => onDelete(offer.id)}>
            Remove
          </Button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start">
        <div className="relative aspect-[16/7] min-h-[150px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-tertiary-soft)] bg-[var(--color-surface-sunken)]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={draft.alt_text}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs text-[var(--color-tertiary)]">
              Choose an image to preview the banner here.
            </div>
          )}
          {saving && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-medium text-white">
              Saving banner...
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)]">
              Alt text
            </span>
            <input
              value={draft.alt_text}
              onChange={(e) => setDraft({ ...draft, alt_text: e.target.value })}
              maxLength={200}
              placeholder="Describe the offer banner"
              className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-tertiary-soft)] bg-[var(--color-primary)] px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-tertiary)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-quaternary)]/60 px-4 py-2.5 text-sm font-medium text-[var(--color-quaternary)] transition-colors hover:bg-[var(--color-quaternary-soft)]">
            {selectedFile ? "Choose a different image" : imageUrl ? "Replace banner image" : "Choose banner image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={saving}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                }
                e.currentTarget.value = "";
              }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)]">
              Target product
            </span>
            <select
              value={draft.product_id ?? ""}
              disabled={saving}
              onChange={(e) => setDraft({ ...draft, product_id: e.target.value || null })}
              className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-tertiary-soft)] bg-[var(--color-primary)] px-3 text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
            >
              <option value="">All products in this offer</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--color-tertiary-soft)] text-[var(--color-quaternary)] focus:ring-[var(--color-quaternary)]"
            />
            Show in Current Offers
          </label>

          <Button
            className="w-full"
            disabled={(!imageUrl && !selectedFile) || !draft.alt_text.trim() || saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving..." : "Save banner"}
          </Button>
        </div>
      </div>
    </div>
  );
}