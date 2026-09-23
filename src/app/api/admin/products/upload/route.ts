/**
 * POST /api/admin/products/upload
 *
 * Accepts multipart/form-data with one or more files under the key "files".
 * Optionally accepts product_id to auto-update the product with uploaded images.
 * Uploads each to Supabase Storage bucket "product-images" and returns
 * the public URL for each. Max 4 images, 5 MB each.
 *
 * If product_id is provided and uploads succeed, automatically updates the product's
 * image_urls and flips status from 'draft' to 'published'.
 *
 * Auth: Firebase ID token in Authorization: Bearer <token>
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { unauthorized, serverError } from "@/lib/http";
import { checkRequestSize, RequestSizeError } from "@/lib/request-limits";
import { handlePreflight, withCors } from "@/lib/cors";
import { NextRequest, NextResponse } from "next/server";
import { asUuid } from "@/lib/http";

const BUCKET = "product-images";
const MAX_FILES = 4;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  // Handle preflight request
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (!(await requireAdmin(req))) return unauthorized();

  // Check request size (max 20 MB for 4 files at 5 MB each)
  try {
    await checkRequestSize(req, 20 * 1024 * 1024);
  } catch (error) {
    if (error instanceof RequestSizeError) {
      const errorResponse = NextResponse.json({ error: error.message }, { status: 413 });
      return withCors(errorResponse, req);
    }
    const errorResponse = NextResponse.json({ error: "Failed to check request size" }, { status: 500 });
    return withCors(errorResponse, req);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    const errorResponse = NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
    return withCors(errorResponse, req);
  }

  const files = formData.getAll("files") as File[];
  const productId = asUuid(formData.get("product_id") as string | null);

  if (!files.length) {
    const errorResponse = NextResponse.json({ error: "No files provided" }, { status: 400 });
    return withCors(errorResponse, req);
  }
  if (files.length > MAX_FILES) {
    const errorResponse = NextResponse.json({ error: `Maximum ${MAX_FILES} images allowed` }, { status: 400 });
    return withCors(errorResponse, req);
  }

  const supabase = getServiceClient();
  const urls: string[] = [];
  const errors: { file: string; error: string }[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push({ file: file.name, error: `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP or GIF.` });
      continue;
    }
    if (file.size > MAX_BYTES) {
      errors.push({ file: file.name, error: `File exceeds 5 MB limit.` });
      continue;
    }

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      errors.push({ file: file.name, error: uploadError.message || "Upload failed" });
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  // Return partial success if some uploads failed
  if (errors.length > 0 && urls.length === 0) {
    const errorResponse = NextResponse.json({ error: "All uploads failed", details: errors }, { status: 400 });
    return withCors(errorResponse, req);
  }
  if (errors.length > 0) {
    const response = NextResponse.json({ urls, errors, partial: true }, { status: 207 }); // 207 Multi-Status
    return withCors(response, req);
  }

  // If product_id is provided, update the product with uploaded images
  if (productId && urls.length > 0) {
    const { data: currentProduct, error: fetchError } = await supabase
      .from("products")
      .select("id, status, image_urls")
      .eq("id", productId)
      .single();
    
    if (!fetchError && currentProduct) {
      const existingUrls = Array.isArray(currentProduct.image_urls) ? currentProduct.image_urls : [];
      const allUrls = [...existingUrls, ...urls].slice(0, 4);
      
      // Flip status from draft to published
      const updateData: Record<string, unknown> = {
        image_urls: allUrls,
        updated_at: new Date().toISOString(),
      };
      
      if (currentProduct.status === "draft") {
        updateData.status = "published";
      }
      
      const { error: updateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", productId);
      
      if (updateError) {
        console.error("Failed to update product with images:", updateError);
        // Continue anyway - images were uploaded successfully
      }
    }
  }

  const response = NextResponse.json({ urls });
  return withCors(response, req);
}

/**
 * DELETE /api/admin/products/upload
 *
 * Body: { paths: string[] }  — Storage paths (NOT full URLs), e.g. "1234-abc.jpg"
 * Removes the specified files from the bucket.
 */
export async function DELETE(req: NextRequest) {
  // Handle preflight request
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (!(await requireAdmin(req))) return unauthorized();

  let body: { paths?: unknown };
  try {
    body = await req.json();
  } catch {
    const errorResponse = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    return withCors(errorResponse, req);
  }

  const paths = Array.isArray(body.paths)
    ? (body.paths as unknown[]).filter((p): p is string => typeof p === "string")
    : [];

  if (!paths.length) {
    const errorResponse = NextResponse.json({ error: "No paths provided" }, { status: 400 });
    return withCors(errorResponse, req);
  }

  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    const errorResponse = serverError(error);
    return withCors(errorResponse, req);
  }

  const response = NextResponse.json({ ok: true });
  return withCors(response, req);
}
