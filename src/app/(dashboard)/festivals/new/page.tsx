"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export default function NewFestivalPage() {
  const router = useRouter();
  const { push } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image_url: "",
    start_date: "",
    end_date: "",
    date: "",
    is_active: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validate date range
    if (formData.start_date && formData.end_date && new Date(formData.start_date) > new Date(formData.end_date)) {
      setError("End date must be after or equal to start date.");
      setSaving(false);
      return;
    }

    try {
      const res = await api.post<{ id?: string; data?: { id?: string } }>("/api/admin/festivals", formData);
      const festivalId = res?.id || res?.data?.id;
      push("Festival created successfully.", "success");
      if (festivalId) {
        router.push(`/festivals/${festivalId}`);
      } else {
        router.push("/festivals");
      }
    } catch (err) {
      console.error('[Frontend] Festival creation error:', err);
      setError(err instanceof ApiError ? err.message : "Failed to create festival.");
      push(err instanceof ApiError ? err.message : "Failed to create festival.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/festivals" className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)]">
            ← Back to Festivals
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Add New Festival
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
            {saving ? "Creating..." : "Create Festival"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}