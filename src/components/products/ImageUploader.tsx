"use client";
/**
 * ImageUploader — drag-and-drop + click-to-upload component for product images.
 *
 * - Accepts up to 4 images (JPEG / PNG / WebP / GIF, max 5 MB each)
 * - Compresses images client-side before upload (target: ≤1 MB, 1200px max)
 * - Supports camera capture on mobile devices
 * - Uploads immediately to /api/admin/products/upload and returns public URLs
 * - Shows inline thumbnails with individual remove buttons
 * - Parent receives the current URL array via onChange
 */
import { useRef, useState, useCallback } from "react";
import { getIdToken } from "@/lib/auth/get-token";

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

const MAX = 4;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_SIZE_PX = 1200;
const TARGET_QUALITY = 0.82;

/** Compress an image file to JPEG, resizing if larger than MAX_SIZE_PX */
async function compressImage(file: File): Promise<File> {
  // Skip GIFs — canvas flattens animation
  if (file.type === "image/gif") return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_SIZE_PX || height > MAX_SIZE_PX) {
        if (width > height) {
          height = Math.round((height / width) * MAX_SIZE_PX);
          width = MAX_SIZE_PX;
        } else {
          width = Math.round((width / height) * MAX_SIZE_PX);
          height = MAX_SIZE_PX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        TARGET_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export function ImageUploader({ urls, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const remaining = MAX - urls.length;

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    const toUpload = files.slice(0, remaining);
    if (!toUpload.length) {
      setError(`Maximum ${MAX} images allowed.`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const token = await getIdToken().catch(() => null);
      // Compress all images client-side in parallel before uploading
      const compressed = await Promise.all(toUpload.map(compressImage));
      const fd = new FormData();
      compressed.forEach((f) => fd.append("files", f));

      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }
      onChange([...urls, ...(json.urls as string[])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const cameraRef = useRef<HTMLInputElement>(null);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    void uploadFiles(files);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      uploadFiles(files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urls]
  );

  function removeImage(idx: number) {
    const next = [...urls];
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)]">
          Product Images{" "}
          <span className="font-normal normal-case text-[var(--color-tertiary)]">
            (up to {MAX}, auto-compressed · JPEG / PNG / WebP)
          </span>
        </label>
        {/* Mobile-specific camera button */}
        {remaining > 0 && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => cameraRef.current?.click()}
            className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-[var(--color-quaternary)] hover:text-[var(--color-quaternary)]/80 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
            Camera
          </button>
        )}
      </div>

      {/* Thumbnail grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {urls.map((url, i) => (
            <div key={url + i} className="relative group aspect-square rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-tertiary-soft)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Product image ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                disabled={disabled || uploading}
                aria-label={`Remove image ${i + 1}`}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity text-white text-2xl font-bold touch-manipulation"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone — hidden when at max */}
      {remaining > 0 && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload images"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className={[
            "flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-[var(--radius-md)] border-2 border-dashed transition-colors cursor-pointer select-none min-h-[120px]",
            dragging
              ? "border-[var(--color-quaternary)] bg-[var(--color-quaternary)]/5"
              : "border-[var(--color-tertiary-soft)] hover:border-[var(--color-quaternary)]/60 hover:bg-[var(--color-quaternary)]/3",
            (disabled || uploading) && "opacity-50 cursor-not-allowed",
          ].join(" ")}
        >
          {uploading ? (
            <>
              <svg className="animate-spin w-7 h-7 text-[var(--color-quaternary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
              </svg>
              <span className="text-sm text-[var(--color-ink-soft)]">Compressing &amp; uploading…</span>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 text-[var(--color-tertiary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm font-medium text-[var(--color-ink)] text-center">
                {dragging ? "Drop to upload" : (
                  <><span className="hidden sm:inline">Click or drag images here</span><span className="sm:hidden">Tap to choose images</span></>
                )}
              </span>
              <span className="text-xs text-[var(--color-tertiary)]">
                {remaining} slot{remaining !== 1 ? "s" : ""} remaining · auto-compressed
              </span>
            </>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={handleInput}
        disabled={disabled || uploading}
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* Camera-only input for mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleInput}
        disabled={disabled || uploading}
        aria-hidden="true"
        tabIndex={-1}
      />

      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
      )}
    </div>
  );
}
