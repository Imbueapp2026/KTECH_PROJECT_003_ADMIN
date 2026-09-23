"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { DiscountType } from "@/lib/data/types";

export default function NewOfferPage() {
  const router = useRouter();
  const { push } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    label: "",
    description: "",
    is_active: true,
    start_date: "",
    end_date: "",
    discount_type: "percentage" as DiscountType,
    discount_value: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const offerPayload = {
        label: formData.label,
        description: formData.description || null,
        is_active: formData.is_active,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };

      const offerRes = await api.post<{ id?: string; data?: { id?: string } }>("/api/admin/offers", offerPayload);
      const offerId = offerRes?.id || offerRes?.data?.id;
      
      // Create discount if value is provided
      if (formData.discount_value && offerId) {
        const discountPayload = {
          offer_id: offerId,
          discount_type: formData.discount_type,
          value: parseFloat(formData.discount_value),
        };
        await api.post("/api/admin/discounts", discountPayload);
      }

      push("Offer created successfully.", "success");
      router.push("/offers");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create offer.");
      push(err instanceof ApiError ? err.message : "Failed to create offer.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/offers" className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)]">
            ← Back to Offers
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Add New Offer
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
          label="Offer Label"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          required
        />

        <div>
          <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20 resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--color-tertiary-soft)] text-[var(--color-quaternary)] focus:ring-[var(--color-quaternary)]"
          />
          <label htmlFor="active" className="text-sm text-[var(--color-ink)]">
            Active
          </label>
        </div>

        <Input
          label="Start Date"
          type="date"
          value={formData.start_date}
          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
        />

        <Input
          label="End Date"
          type="date"
          value={formData.end_date}
          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
        />

        <div className="border-t border-[var(--color-tertiary-soft)] pt-6">
          <h2 className="text-base font-semibold text-[var(--color-ink)] mb-4">Discount (Optional)</h2>
          
          <div>
            <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
              Discount Type
            </label>
            <select
              value={formData.discount_type}
              onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as DiscountType })}
              className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
            >
              <option value="percentage">Percentage</option>
              <option value="flat">Flat Amount</option>
            </select>
          </div>

          <div className="mt-4">
            <Input
              label={formData.discount_type === "percentage" ? "Discount Value (%)" : "Discount Amount (₹)"}
              type="number"
              step="0.01"
              value={formData.discount_value}
              onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
              placeholder={formData.discount_type === "percentage" ? "e.g., 10" : "e.g., 500"}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[var(--color-tertiary-soft)]">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Offer"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
