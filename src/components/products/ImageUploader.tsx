"use client";
/**
 * ImageUploader — drag-and-drop + click-to-upload component for product images.
 *
 * - Accepts up to 4 images (JPEG / PNG / WebP / GIF, max 5 MB each)
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
      const fd = new FormData();
      toUpload.forEach((f) => fd.append("files", f));

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

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    uploadFiles(files);
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
      <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)]">
        Product Images{" "}
        <span className="font-normal normal-case text-[var(--color-tertiary)]">
          (up to {MAX}, 5 MB each · JPEG / PNG / WebP)
        </span>
      </label>

      {/* Thumbnail grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
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
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xl font-bold"
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
            "flex flex-col items-center justify-center gap-2 p-6 rounded-[var(--radius-md)] border-2 border-dashed transition-colors cursor-pointer select-none",
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
              <span className="text-sm text-[var(--color-ink-soft)]">Uploading…</span>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 text-[var(--color-tertiary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm font-medium text-[var(--color-ink)]">
                {dragging ? "Drop to upload" : "Click or drag images here"}
              </span>
              <span className="text-xs text-[var(--color-tertiary)]">
                {remaining} slot{remaining !== 1 ? "s" : ""} remaining
              </span>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
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

      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
      )}
    </div>
  );
}
