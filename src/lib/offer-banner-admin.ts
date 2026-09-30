import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type OfferBannerRow = {
  id: string;
  offer_id: string;
  product_id: string | null;
  image_url: string;
  alt_text: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export class OfferBannerInputError extends Error {}

export function getOfferBannerStoragePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl);
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!configuredUrl || url.origin !== new URL(configuredUrl).origin || url.search || url.hash) return null;

    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    if (!url.pathname.startsWith(prefix)) return null;

    const path = url.pathname.slice(prefix.length).split("/").map(decodeURIComponent).join("/");
    if (!path || path.split("/").includes("..")) return null;
    return path;
  } catch {
    return null;
  }
}

function safeFilename(filename: string, contentType: string): string {
  const basename = filename.split(/[\\/]/).pop() ?? "";
  const name = basename.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
  return `${name || "banner"}.${extension}`;
}

async function removeStoragePath(supabase: SupabaseClient, path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function removeOfferBannerImage(
  supabase: SupabaseClient,
  imageUrl: string | null | undefined,
): Promise<void> {
  const path = getOfferBannerStoragePath(imageUrl);
  if (path) await removeStoragePath(supabase, path);
}

export async function saveOfferBanner(
  supabase: SupabaseClient,
  input: {
    offerId: string;
    productId: string | null;
    file: File | null;
    altText: string;
    isActive: boolean;
    displayOrder: number;
  },
): Promise<OfferBannerRow> {
  const altText = input.altText.trim();
  if (!altText || altText.length > 200) throw new OfferBannerInputError("alt_text is required");
  if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0) {
    throw new OfferBannerInputError("display_order must be a non-negative integer");
  }
  if (input.file && !ALLOWED_TYPES.has(input.file.type)) {
    throw new OfferBannerInputError("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
  }
  if (input.file && input.file.size > MAX_FILE_SIZE) {
    throw new OfferBannerInputError("File too large. Maximum size is 5MB.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("offer_banners")
    .select("image_url")
    .eq("offer_id", input.offerId)
    .maybeSingle();
  if (existingError) throw existingError;

  let imageUrl = existing?.image_url as string | undefined;
  let uploadedPath: string | null = null;

  if (input.file) {
    const path = `offer-banners/${input.offerId}/${Date.now()}-${randomUUID()}-${safeFilename(input.file.name, input.file.type)}`;
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await input.file.arrayBuffer()), {
        contentType: input.file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    uploadedPath = uploaded.path;
    imageUrl = supabase.storage.from(BUCKET).getPublicUrl(uploaded.path).data.publicUrl;
    if (!getOfferBannerStoragePath(imageUrl)) {
      try {
        await removeStoragePath(supabase, uploadedPath);
      } catch (cleanupError) {
        console.error("[offer-banner] Failed to clean up an invalid public URL upload", cleanupError);
      }
      throw new Error("Storage did not return a public banner URL");
    }
  } else if (!getOfferBannerStoragePath(imageUrl)) {
    throw new OfferBannerInputError("A banner image is required");
  }

  const { data, error } = await supabase
    .from("offer_banners")
    .upsert({
      offer_id: input.offerId,
      product_id: input.productId,
      image_url: imageUrl,
      alt_text: altText,
      is_active: input.isActive,
      display_order: input.displayOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "offer_id" })
    .select("id, offer_id, product_id, image_url, alt_text, is_active, display_order, created_at, updated_at")
    .single();

  if (error) {
    if (uploadedPath) {
      try {
        await removeStoragePath(supabase, uploadedPath);
      } catch (cleanupError) {
        console.error("[offer-banner] Failed to clean up an upload after save failure", cleanupError);
      }
    }
    throw error;
  }

  if (uploadedPath && existing?.image_url) {
    try {
      await removeOfferBannerImage(supabase, existing.image_url);
    } catch (cleanupError) {
      console.error("[offer-banner] Failed to remove the replaced banner image", cleanupError);
    }
  }

  return data as OfferBannerRow;
}

export async function deleteOfferBanner(supabase: SupabaseClient, offerId: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from("offer_banners")
    .select("image_url")
    .eq("offer_id", offerId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { error } = await supabase.from("offer_banners").delete().eq("offer_id", offerId);
  if (error) throw error;

  await removeOfferBannerImage(supabase, existing?.image_url);
}