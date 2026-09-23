/**
 * POST /api/admin/upload — upload images to Supabase Storage
 * Accepts multipart/form-data with file field.
 * Returns the public URL of the uploaded file.
 */
import { getServiceClient } from "@/lib/supabase";
import { badRequest, serverError } from "@/lib/http";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return badRequest("No file provided");
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return badRequest("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequest("File too large. Maximum size is 5MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const supabase = getServiceClient();
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return serverError("Failed to upload file");
    }

    const { data: { publicUrl } } = supabase.storage
      .from("product-images")
      .getPublicUrl(data.path);

    return Response.json({ url: publicUrl, path: data.path });
  } catch (err) {
    console.error("Upload error:", err);
    return serverError("Unexpected error during upload");
  }
}
