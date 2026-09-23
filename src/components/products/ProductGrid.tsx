"use client";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPrice, resolveDiscounted } from "@/lib/utils";
import type {
  Category,
  Discount,
  Offer,
  Product,
} from "@/lib/data/types";

export type ProductCardData = Product & {
  category?: Category | null;
  offer?: (Offer & { discount: Discount[] | Discount | null }) | null;
};


export function ProductCard({
  product,
  href,
}: {
  product: ProductCardData;
  href: string;
}) {
  const discounted = resolveDiscounted(product.price, product.offer ?? null);
  const onSale = discounted != null;
  const cover = product.image_urls[0];
  const isArchived = product.status === "archived";
  return (
    <Link
      href={href}
      className={`group block bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] shadow-[var(--shadow-card)] overflow-hidden focus-ring transition-all duration-150 hover:border-[var(--color-quaternary)]/40 hover:shadow-[var(--shadow-modal)] ${
        isArchived ? "opacity-60" : ""
      }`}
    >
      <div className="aspect-square bg-[var(--color-surface-sunken)] relative overflow-hidden border-b border-[var(--color-tertiary-soft)]">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-tertiary)] text-[10px] uppercase tracking-[0.08em] font-semibold">
            No image
          </div>
        )}
        {onSale && (
          <div className="absolute top-2 left-2">
            <Badge tone="new">{product.offer?.label}</Badge>
          </div>
        )}
        {isArchived && (
          <div className="absolute top-2 right-2">
            <Badge tone="neutral">Archived</Badge>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)] truncate">
          {product.category?.name ?? "Uncategorised"}
        </p>
        <p className="text-sm font-semibold text-[var(--color-ink)] truncate">
          {product.name}
        </p>
        <div className="flex items-baseline gap-2 pt-1">
          {onSale ? (
            <>
              <span className="text-base font-semibold text-[var(--color-quaternary)]">
                {formatPrice(discounted!)}
              </span>
              <span className="text-xs text-[var(--color-tertiary)] line-through">
                {formatPrice(product.price)}
              </span>
            </>
          ) : (
            <span className="text-base font-semibold text-[var(--color-ink)]">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 pt-1 mt-auto">
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
          {product.hallmark_certified && (
            <Badge tone="gold">Hallmark</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] overflow-hidden"
        >
          <Skeleton className="aspect-square rounded-none" />
          <div className="p-4 flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductGrid({
  products,
  hrefBase,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  products: ProductCardData[];
  hrefBase: (id: string) => string;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  if (products.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} href={hrefBase(p.id)} />
      ))}
    </div>
  );
}