import type { OfferConflictGroup } from "./offer-assignment-admin";

export type OfferAssignmentPreview = {
  conflicts: number;
  byOffer: OfferConflictGroup[];
  productCount: number;
};

export function formatOfferOverrideWarning(conflicts: number, byOffer: OfferConflictGroup[]): string {
  const offerSummary = byOffer.map(({ label, productCount }) => `${label}: ${productCount} products`).join(", ");
  return `This will replace the existing offer on ${conflicts} products (${offerSummary}). Their current offers will be removed from those products.`;
}

export function formatOfferAssignmentConfirmation(
  scope: "all" | "selected",
  offerLabel: string,
  preview: OfferAssignmentPreview,
): string {
  if (preview.conflicts > 0) return formatOfferOverrideWarning(preview.conflicts, preview.byOffer);
  return scope === "all"
    ? `Apply to all ${preview.productCount} products?`
    : `Apply "${offerLabel}" to ${preview.productCount} selected products?`;
}

export function readOfferAssignmentPreview(value: unknown): OfferAssignmentPreview | null {
  if (!value || typeof value !== "object") return null;
  const preview = value as Partial<OfferAssignmentPreview>;
  if (!Number.isInteger(preview.conflicts) || !Array.isArray(preview.byOffer)) return null;
  if (!Number.isInteger(preview.productCount)) return null;
  return preview as OfferAssignmentPreview;
}