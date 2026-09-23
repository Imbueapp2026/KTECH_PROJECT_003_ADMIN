"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Festival } from "@/lib/data/types";

export default function FestivalEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [festival, setFestival] = useState<Festival | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image_url: "",
    date: "",
    start_date: "",
    end_date: "",
    is_active: false,
  });

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ data: Festival }>(`/api/admin/festivals/${params.id}`);
        if (cancelled) return;
        setFestival(res.data);
        setFormData({
          name: res.data.name,
          description: res.data.description || "",
          image_url: res.data.image_url || "",
          date: res.data.date || "",
          start_date: res.data.start_date || "",
          end_date: res.data.end_date || "",
          is_active: res.data.is_active,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load festival.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate date range
    if (formData.start_date && formData.end_date && new Date(formData.start_date) > new Date(formData.end_date)) {
      push("End date must be after or equal to start date.", "danger");
      return;
    }
    
    setSaving(true);
    setError(null);

    try {
      await api.patch(`/api/admin/festivals/${params.id}`, formData);
      push("Festival updated successfully.", "success");
      router.push(`/festivals/${params.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update festival.");
      push(err instanceof ApiError ? err.message : "Failed to update festival.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-5 md:p-8 max-w-4xl flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error && !festival) {
    return (
      <div className="p-5 md:p-8 max-w-4xl">
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)] mb-4"
        >
          ← Back to Festival
        </button>
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)] mb-2"
          >
            ← Back to Festival
          </button>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Edit Festival
          </h1>
        </div>
      </header>

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input
          label="Festival Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <div>
          <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20 resize-none"
          />
        </div>

        <Input
          label="Image URL"
          value={formData.image_url}
          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          placeholder="https://example.com/image.jpg"
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
              End Date
            </label>
            <input
              type="datetime-local"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
            Display Date (Legacy)
          </label>
          <input
            type="text"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
            placeholder="e.g., November 2026"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--color-tertiary-soft)] text-[var(--color-quaternary)] focus:ring-[var(--color-quaternary)]"
          />
          <label htmlFor="is_active" className="text-sm text-[var(--color-ink)]">
            Set as active festival (will deactivate other festivals)
          </label>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[var(--color-tertiary-soft)]">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}