"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatPrice, resolveDiscounted } from "@/lib/utils";
import type {
  Category,
  Discount,
  Offer,
  Product,
} from "@/lib/data/types";

type Detail = Product & {
  category: Category | null;
  offer: (Offer & { discount: Discount[] | Discount | null }) | null;
  purity_carats?: number | null;
  weight_grams?: number | null;
  net_weight_grams?: number | null;
  making_charge_percent?: number | null;
  making_charge_flat?: number | null;
  making_charge_type?: 'percent' | 'flat' | null;
  certifications?: string | null;
  gold_price_used?: number | null;
  price_auto_calculated?: boolean;
  gst_percent?: number | null;
};


export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { push } = useToast();
  const [product, setProduct] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ data?: Detail } & Detail>(`/api/admin/products/${id}`);
        if (!cancelled) setProduct(res?.data || res);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load product.");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function archive() {
    if (!product) return;
    setArchiving(true);
    try {
      await api.delete(`/api/admin/products/${product.id}`);
      push("Product archived.", "success");
      router.replace("/products");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Could not archive product.", "danger");
    } finally {
      setArchiving(false);
      setConfirmOpen(false);
    }
  }

  if (error) {
    return (
      <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-tertiary)] hover:text-[var(--color-ink)] focus-ring self-start"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Back to dashboard
        </Link>
        <p
          className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3"
          role="alert"
        >
          {error}
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-1/2" />
        <div className="grid md:grid-cols-2 gap-6 mt-2">
          <Skeleton className="aspect-square rounded-[var(--radius-md)]" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    );
  }

  const discounted = resolveDiscounted(product.price, product.offer);
  const onSale = discounted != null;

  return (
    <div className="p-5 md:p-8 max-w-6xl flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-tertiary)] hover:text-[var(--color-ink)] focus-ring self-start"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Back to dashboard
      </Link>
      <header className="flex items-start justify-between gap-4 flex-wrap border-b border-[var(--color-tertiary-soft)] pb-5">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
            {product.category?.name ?? "Uncategorised"}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            {product.name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Badge
              tone={
                product.availability === "available"
                  ? "success"
                  : product.availability === "made_to_order"
                    ? "info"
                    : "danger"
              }
            >
              {product.availability.replace("_", " ")}
            </Badge>
            <Badge
              tone={
                product.status === "published"
                  ? "success"
                  : product.status === "draft"
                    ? "neutral"
                    : "warning"
              }
            >
              {product.status}
            </Badge>
            {product.hallmark_certified && <Badge tone="gold">Hallmark certified</Badge>}
            {onSale && <Badge tone="new">{product.offer?.label}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/products/${product.id}/edit`}
            className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-primary)] text-[var(--color-ink)] border border-[var(--color-tertiary-soft)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-tertiary)] focus-ring"
          >
            Edit
          </Link>
          <Button
            variant="danger"
            onClick={() => setConfirmOpen(true)}
            disabled={archiving || product.status === "archived"}
          >
            {product.status === "archived" ? "Archived" : "Archive"}
          </Button>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] p-4">
          <div className="grid grid-cols-2 gap-2">
            {(product.image_urls.length > 0 ? product.image_urls : [null]).map((src, i) =>
              src ? (
                <div key={i} className="aspect-square relative rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] border border-[var(--color-tertiary-soft)]">
                  <Image
                    src={src}
                    alt={`${product.name} ${i + 1}`}
                    fill
                    className="object-cover rounded-[var(--radius-sm)]"
                    sizes="(max-width: 768px) 50vw, 400px"
                  />
                </div>
              ) : (
                <div
                  key={i}
                  className="aspect-square flex items-center justify-center text-[var(--color-tertiary)] text-xs uppercase tracking-[0.04em] rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] border border-dashed border-[var(--color-tertiary-soft)]"
                >
                  No image
                </div>
              ),
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="bg-[var(--color-quaternary-soft)]/40 border border-[var(--color-quaternary)]/20 rounded-[var(--radius-md)] p-5">
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
              Price
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              {onSale ? (
                <>
                  <span className="text-3xl font-semibold text-[var(--color-quaternary)]">
                    {formatPrice(discounted!)}
                  </span>
                  <span className="text-sm text-[var(--color-tertiary)] line-through">
                    {formatPrice(product.price)}
                  </span>
                </>
              ) : (
                <span className="text-3xl font-semibold text-[var(--color-ink)]">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>
          </div>

          {product.description && (
            <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] p-5">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-2">
                Description
              </p>
              <p className="text-sm leading-relaxed text-[var(--color-ink-soft)] whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          )}

          <div className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] p-5">
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-tertiary)] mb-3">
              Details
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-[var(--color-tertiary)]">Category</dt>
              <dd className="font-medium">{product.category?.name ?? "—"}</dd>
              <dt className="text-[var(--color-tertiary)]">Offer</dt>
              <dd className="font-medium">{product.offer?.label ?? "No offer"}</dd>
              <dt className="text-[var(--color-tertiary)]">Created</dt>
              <dd className="font-medium">{new Date(product.created_at).toLocaleDateString()}</dd>
              <dt className="text-[var(--color-tertiary)]">Updated</dt>
              <dd className="font-medium">{new Date(product.updated_at).toLocaleDateString()}</dd>
            </dl>
          </div>

          {/* Metal Pricing Details */}
          {product.price_auto_calculated !== false && <div className="bg-[var(--color-quaternary-soft)]/40 border border-[var(--color-quaternary)]/20 rounded-[var(--radius-md)] p-5">
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)] mb-3">
              {product.material_type === "silver" ? "Silver Pricing" : "Gold Pricing"}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-[var(--color-tertiary)]">Purity</dt>
              <dd className="font-medium">{product.purity_carats ? `${product.purity_carats}K` : "—"}</dd>
              <dt className="text-[var(--color-tertiary)]">{product.net_weight_grams ? "Gross Weight" : "Weight"}</dt>
              <dd className="font-medium">{product.weight_grams ? `${product.weight_grams.toFixed(1)}g` : "—"}</dd>
              {product.net_weight_grams && (
                <>
                  <dt className="text-[var(--color-tertiary)]">Net Weight</dt>
                  <dd className="font-medium">{`${product.net_weight_grams.toFixed(1)}g`}</dd>
                </>
              )}
              <dt className="text-[var(--color-tertiary)]">Making Charge</dt>
              <dd className="font-medium">
                {product.making_charge_type === 'percent' && product.making_charge_percent
                  ? `${product.making_charge_percent}% of gold value`
                  : product.making_charge_type === 'flat' && product.making_charge_flat
                  ? `₹${formatPrice(product.making_charge_flat)} flat`
                  : "—"
                }
              </dd>
              <dt className="text-[var(--color-tertiary)]">Gold Price Used</dt>
              <dd className="font-medium">
                {product.gold_price_used ? `₹${product.gold_price_used.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/gram` : "—"}
              </dd>
              {product.certifications && (
                <>
                  <dt className="text-[var(--color-tertiary)]">Certifications</dt>
                  <dd className="font-medium">{product.certifications}</dd>
                </>
              )}
            </dl>
          </div>}

          {/* Price Breakdown */}
          <div className="bg-[var(--color-quaternary-soft)]/40 border border-[var(--color-quaternary)]/20 rounded-[var(--radius-md)] p-5">
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)] mb-3">
              Price Breakdown
            </p>
            <div className="space-y-2 text-sm">
              {product.price_auto_calculated === false ? (
                <div className="flex justify-between">
                  <span className="text-[var(--color-tertiary)]">Direct Price</span>
                  <span className="font-medium">
                    {product.gst_percent != null
                      ? formatPrice(product.price / (1 + product.gst_percent / 100))
                      : formatPrice(product.price)}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-tertiary)]">Gold Value</span>
                    <span className="font-medium">
                      {product.purity_carats && product.weight_grams && product.gold_price_used
                        ? formatPrice(product.purity_carats / 24 * product.weight_grams * product.gold_price_used)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-tertiary)]">Making Charge</span>
                    <span className="font-medium">
                      {product.making_charge_type === 'percent' && product.making_charge_percent && product.purity_carats && product.weight_grams && product.gold_price_used
                        ? formatPrice((product.purity_carats / 24 * product.weight_grams * product.gold_price_used) * (product.making_charge_percent / 100))
                        : product.making_charge_type === 'flat' && product.making_charge_flat
                        ? formatPrice(product.making_charge_flat)
                        : "—"}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--color-tertiary)]">GST ({product.gst_percent ?? 5}%)</span>
                <span className="font-medium">
                  {product.gst_percent != null
                    ? formatPrice(product.price - product.price / (1 + product.gst_percent / 100))
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[var(--color-tertiary-soft)]">
                <span className="text-[var(--color-tertiary)] font-semibold">Final Price</span>
                <span className="font-semibold">{formatPrice(product.price)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Archive this product?"
        description="It will be hidden from the public catalog but kept in your records."
        confirmLabel="Archive"
        destructive
        onConfirm={archive}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}