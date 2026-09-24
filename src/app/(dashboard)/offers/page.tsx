"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProductGrid } from "@/components/products/ProductGrid";
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

type BannerDraft = {
  image_url: string;
  alt_text: string;
  is_active: boolean;
  display_order: number;
};

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

  async function uploadBannerImage(_offerId: string, file: File) {
    const formData = new FormData();
    formData.append("files", file);
    const token = await (await import("@/lib/auth/get-token")).getIdToken().catch(() => null);
    const response = await fetch("/api/admin/products/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    const result = await response.json();
    if (!response.ok || !result.urls?.[0]) throw new Error(result.error ?? "Banner image upload failed.");
    return result.urls[0] as string;
  }

  async function saveBanner(offer: OfferWithDiscounts, draft: BannerDraft) {
    try {
      const response = await api.put<{ data: OfferWithDiscounts["offer_banners"][number] }>(`/api/admin/offers/${offer.id}/banner`, draft);
      setOffers((current) => current?.map((item) => item.id === offer.id ? { ...item, offer_banners: [response.data] } : item) ?? null);
      push("Offer banner saved.", "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to save offer banner.", "danger");
    }
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
            <OfferBannerEditor
              key={`${o.id}-${o.offer_banners?.[0]?.id ?? "empty"}`}
              offer={o}
              onUpload={uploadBannerImage}
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
    </div>
  );
}

function OfferBannerEditor({
  offer,
  onUpload,
  onSave,
  onDelete,
}: {
  offer: OfferWithDiscounts;
  onUpload: (offerId: string, file: File) => Promise<string>;
  onSave: (offer: OfferWithDiscounts, draft: BannerDraft) => Promise<void>;
  onDelete: (offerId: string) => Promise<void>;
}) {
  const banner = offer.offer_banners?.[0];
  const [draft, setDraft] = useState<BannerDraft>({
    image_url: banner?.image_url ?? "",
    alt_text: banner?.alt_text ?? `${offer.label} offer`,
    is_active: banner?.is_active ?? true,
    display_order: banner?.display_order ?? 0,
  });
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await onUpload(offer.id, file);
      setDraft((current) => ({ ...current, image_url: imageUrl }));
    } finally {
      setUploading(false);
    }
  }

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
            Visitors will see every product included in this offer when they tap the banner.
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
          {draft.image_url && draft.image_url !== "pending" ? (
            <img
              src={draft.image_url}
              alt="Current offer banner preview"
              className="h-full w-full object-fill"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs text-[var(--color-tertiary)]">
              Choose an image to preview the banner here.
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-medium text-white">
              Uploading image...
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
            {uploading ? "Uploading..." : draft.image_url ? "Replace banner image" : "Choose banner image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
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
            disabled={!draft.image_url || draft.image_url === "pending" || !draft.alt_text || uploading}
            onClick={() => void onSave(offer, draft)}
          >
            Save banner
          </Button>
        </div>
      </div>
    </div>
  );
}