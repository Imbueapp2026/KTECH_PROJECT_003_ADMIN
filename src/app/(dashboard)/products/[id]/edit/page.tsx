"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ImageUploader } from "@/components/products/ImageUploader";
import { calculateDirectPrice, calculateMetalPrice, PURITY_OPTIONS, MAKING_CHARGE_TYPES } from "@/lib/pricing";
import type { Product, Category, Offer, Discount } from "@/lib/data/types";

type Detail = Product & {
  category: Category | null;
  offer: (Offer & { discount: Discount[] | Discount | null }) | null;
  purity_carats?: number | null;
  weight_grams?: number | null;
  net_weight_grams?: number | null;
  making_charge_percent?: number | null;
  making_charge_flat?: number | null;
  making_charge_type?: 'percent' | 'flat' | null;
  certifications?: string | null;
  gold_price_used?: number | null;
  price_auto_calculated?: boolean;
  gst_percent?: number | null;
  material_type?: 'gold' | 'silver' | null;
  festival_id?: string | null; // Optional - may not exist if migration not applied
};

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { push } = useToast();
  const [product, setProduct] = useState<Detail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [silverPrice, setSilverPrice] = useState<number | null>(null);
  const [metalPriceLoading, setMetalPriceLoading] = useState(true);

  const [formData, setFormData] = useState<{
    name: string;
    category_id: string;
    description: string;
    hallmark_certified: boolean;
    availability: string;
    offer_id: string;
    status: "draft" | "published" | "archived";
    pricing_mode: "direct" | "metal";
    material_type: "gold" | "silver";
    direct_price: string;
    purity_carats: 24 | 22 | 18 | 14 | 9;
    weight_grams: string;
    net_weight_grams: string;
    making_charge: string;
    making_charge_type: "percent" | "flat";
    gst_percent: string;
    certifications: string;
    festival_id: string;
  }>({
    name: "",
    category_id: "",
    description: "",
    hallmark_certified: false,
    availability: "",
    offer_id: "",
    status: "draft",
    pricing_mode: "metal",
    material_type: "gold",
    direct_price: "",
    purity_carats: 22,
    weight_grams: "",
    net_weight_grams: "",
    making_charge: "",
    making_charge_type: "percent",
    gst_percent: "5",
    certifications: "",
    festival_id: "",
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const calculateEstimatedPrice = (): number => {
    if (formData.pricing_mode === "direct" && formData.direct_price && !isNaN(parseFloat(formData.direct_price))) {
      return calculateDirectPrice(parseFloat(formData.direct_price), parseFloat(formData.gst_percent));
    }
    const activePrice = formData.material_type === 'silver' ? silverPrice : goldPrice;
    if (!activePrice || !formData.weight_grams || !formData.making_charge) return 0;
    
    return calculateMetalPrice({
      metalPricePerGram: activePrice,
      purityCarats: formData.material_type === 'gold' ? formData.purity_carats : null,
      weightGrams: parseFloat(formData.weight_grams),
      makingCharge: parseFloat(formData.making_charge),
      makingChargeType: formData.making_charge_type,
      gstPercent: parseFloat(formData.gst_percent),
      materialType: formData.material_type,
    });
  };

  useEffect(() => {
    async function loadData() {
      try {
        const id = (await params).id;
        const [prodRes, catRes, offerRes, goldRes, silverRes] = await Promise.all([
          api.get<{ data?: Detail } & Detail>(`/api/admin/products/${id}`),
          api.get<{ data?: Category[] } & Category[]>("/api/admin/categories"),
          api.get<{ data?: Offer[] } & Offer[]>("/api/admin/offers"),
          api.get<{ price_per_gram: number | null }>("/api/admin/gold-price").catch(() => ({ price_per_gram: null })),
          api.get<{ price_per_gram: number | null }>("/api/admin/silver-price").catch(() => ({ price_per_gram: null })),
        ]);
        
        const productData = prodRes?.data || prodRes;
        const categoriesData = Array.isArray(catRes?.data) ? catRes.data : Array.isArray(catRes) ? catRes : [];
        const offersData = Array.isArray(offerRes?.data) ? offerRes.data : Array.isArray(offerRes) ? offerRes : [];
        
        setProduct(productData);
        setCategories(categoriesData);
        setOffers(offersData);
        setGoldPrice(goldRes.price_per_gram);
        setSilverPrice(silverRes.price_per_gram);
        
        setFormData({
          name: productData.name || "",
          category_id: productData.category_id || "",
          description: productData.description || "",
          hallmark_certified: productData.hallmark_certified || false,
          availability: productData.availability || "",
          offer_id: productData.offer_id || "",
          status: (productData.status || "draft") as "draft" | "published" | "archived",
          pricing_mode: productData.price_auto_calculated === false ? "direct" : "metal",
          material_type: (productData.material_type || "gold") as "gold" | "silver",
          direct_price: productData.price_auto_calculated === false ? productData.price?.toString() || "" : "",
          purity_carats: (productData.purity_carats || 22) as 24 | 22 | 18 | 14 | 9,
          weight_grams: productData.weight_grams?.toString() || "",
          net_weight_grams: productData.net_weight_grams?.toString() || "",
          making_charge: (productData.making_charge_percent || productData.making_charge_flat)?.toString() || "",
          making_charge_type: (productData.making_charge_type || "percent") as "percent" | "flat",
          gst_percent: productData.gst_percent?.toString() || "5",
          certifications: productData.certifications || "",
          festival_id: productData.festival_id || "",
        });
        setImageUrls(productData.image_urls ?? []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load product.");
      } finally {
        setLoading(false);
        setMetalPriceLoading(false);
      }
    }
    loadData();
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const id = (await params).id;
      const payload: Record<string, unknown> = {
        name: formData.name,
        category_id: formData.category_id || null,
        description: formData.description,
        hallmark_certified: formData.hallmark_certified,
        availability: formData.availability,
        offer_id: formData.offer_id || null,
        status: formData.status,
        image_urls: imageUrls,
        // Material and pricing fields
        material_type: formData.material_type,
        price: formData.pricing_mode === "direct" && formData.direct_price ? parseFloat(formData.direct_price) : null,
        purity_carats: formData.material_type === 'gold' ? formData.purity_carats : null,
        weight_grams: formData.weight_grams ? parseFloat(formData.weight_grams) : null,
        net_weight_grams: formData.net_weight_grams ? parseFloat(formData.net_weight_grams) : null,
        making_charge_percent: formData.pricing_mode === "metal" && formData.making_charge_type === 'percent' ? (formData.making_charge ? parseFloat(formData.making_charge) : null) : null,
        making_charge_flat: formData.pricing_mode === "metal" && formData.making_charge_type === 'flat' ? (formData.making_charge ? parseFloat(formData.making_charge) : null) : null,
        making_charge_type: formData.pricing_mode === "metal" ? formData.making_charge_type : null,
        gst_percent: formData.gst_percent ? parseFloat(formData.gst_percent) : 5,
        certifications: formData.certifications || null,
        festival_id: formData.festival_id || null,
      };

      console.log('[Frontend] Updating product payload:', JSON.stringify(payload, null, 2));

      await api.patch(`/api/admin/products/${id}`, payload);
      push("Product updated successfully.", "success");
      router.push(`/products/${id}`);
    } catch (err) {
      console.error('[Frontend] Product update error:', err);
      setError(err instanceof ApiError ? err.message : "Failed to update product.");
      push(err instanceof ApiError ? err.message : "Failed to update product.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-5 md:p-8 max-w-4xl flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="p-5 md:p-8 max-w-4xl">
        <Link href="/products" className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)]">
          ← Back to Products
        </Link>
        <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/products" className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)]">
            ← Back to Products
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Edit Product
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
          label="Product Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <div>
          <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
            Category
          </label>
          <select
            value={formData.category_id}
            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            required
            className="w-full px-3 py-2 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20 resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="hallmark"
            checked={formData.hallmark_certified}
            onChange={(e) => setFormData({ ...formData, hallmark_certified: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--color-tertiary-soft)] text-[var(--color-quaternary)] focus:ring-[var(--color-quaternary)]"
          />
          <label htmlFor="hallmark" className="text-sm text-[var(--color-ink)]">
            Hallmark Certified
          </label>
        </div>

        {/* Temporarily hidden until migration runs
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            Festival Collection
          </label>
          <select
            value={formData.festival_id}
            onChange={(e) => setFormData({ ...formData, festival_id: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--color-tertiary-soft)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]"
          >
            <option value="">No festival</option>
            {festivals.map((festival) => (
              <option key={festival.id} value={festival.id}>
                {festival.name} {festival.is_active ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>
        */}

        <div>
          <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
            Availability
          </label>
          <select
            value={formData.availability}
            onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
            className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
          >
            <option value="available">Available (In Stock)</option>
            <option value="made_to_order">Made to Order</option>
            <option value="sold">Sold Out</option>
          </select>
        </div>

        {/* Material and Pricing Section */}
        <div className="bg-[var(--color-quaternary-soft)]/40 border border-[var(--color-quaternary)]/20 rounded-[var(--radius-md)] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)]">
              Material & Pricing
            </p>
          </div>

          <div className="mb-4">
            <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
              Pricing Method
            </label>
            <select
              value={formData.pricing_mode}
              onChange={(e) => setFormData({ ...formData, pricing_mode: e.target.value as "direct" | "metal" })}
              className="h-10 w-full px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)]"
            >
              <option value="direct">Direct Pricing</option>
              <option value="metal">Gold / Silver Pricing</option>
            </select>
          </div>

          {formData.pricing_mode === "direct" && <div className="mb-4">
            <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
              Direct Price (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.direct_price}
              onChange={(e) => setFormData({ ...formData, direct_price: e.target.value })}
              className="h-10 w-full px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
              placeholder="Leave blank to calculate from metal pricing"
            />
            <p className="text-xs text-[var(--color-tertiary)] mt-1">
              Enter a price to use it directly. Leave blank for automatic pricing.
            </p>
          </div>}

          {formData.pricing_mode === "metal" && <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
                Material Type
              </label>
              <select
                value={formData.material_type}
                onChange={(e) => setFormData({ ...formData, material_type: e.target.value as "gold" | "silver" })}
                className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
              >
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
              </select>
            </div>

          </div>}

          <div className="mt-4">
            <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
              GST (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.gst_percent}
              onChange={(e) => setFormData({ ...formData, gst_percent: e.target.value })}
              className="h-10 w-full px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
              placeholder="5"
            />
          </div>

          {formData.pricing_mode === "metal" && formData.material_type === 'gold' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
                  Purity <span className="text-[var(--color-error)]">*</span>
                </label>
                <select
                  value={formData.purity_carats}
                  onChange={(e) => setFormData({ ...formData, purity_carats: parseInt(e.target.value) as 24 | 22 | 18 | 14 | 9 })}
                  className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
                  required={!formData.direct_price}
                >
                  {PURITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
                  Weight (grams) <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weight_grams}
                  onChange={(e) => setFormData({ ...formData, weight_grams: e.target.value })}
                  className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
                  placeholder="10.0"
                  required={!formData.direct_price}
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
                  Net Weight (grams)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.net_weight_grams}
                  onChange={(e) => setFormData({ ...formData, net_weight_grams: e.target.value })}
                  className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
                  placeholder="9.5"
                />
              </div>
            </div>
          )}

          {formData.pricing_mode === "metal" && formData.material_type === 'silver' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
                  Weight (grams) <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weight_grams}
                  onChange={(e) => setFormData({ ...formData, weight_grams: e.target.value })}
                  className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
                  placeholder="10.0"
                  required={!formData.direct_price}
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
                  Net Weight (grams)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.net_weight_grams}
                  onChange={(e) => setFormData({ ...formData, net_weight_grams: e.target.value })}
                  className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
                  placeholder="9.5"
                />
              </div>
            </div>
          )}

          {formData.pricing_mode === "metal" && <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
                Making Charge Type
              </label>
              <select
                value={formData.making_charge_type}
                onChange={(e) => setFormData({ ...formData, making_charge_type: e.target.value as "percent" | "flat" })}
                className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
              >
                {MAKING_CHARGE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
                Making Charge {formData.making_charge_type === 'percent' ? '(%)' : '(₹)'} <span className="text-[var(--color-error)]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.making_charge}
                onChange={(e) => setFormData({ ...formData, making_charge: e.target.value })}
                className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
                placeholder={formData.making_charge_type === 'percent' ? '10' : '500'}
                required={!formData.direct_price}
              />
            </div>
          </div>}

          <div className="mt-4">
            <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
              Certifications
            </label>
            <input
              type="text"
              value={formData.certifications}
              onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
              className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
              placeholder="e.g., BIS Hallmark, IGI, GIA"
            />
          </div>

          {/* Live Price Preview */}
          <div className="mt-4 pt-4 border-t border-[var(--color-quaternary)]/20">
            {formData.pricing_mode === "direct" && formData.direct_price && !isNaN(parseFloat(formData.direct_price)) ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)] mb-1">
                  Direct Price (Override Active)
                </p>
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between text-[var(--color-tertiary)]">
                    <span>Direct Price</span>
                    <span>₹{parseFloat(formData.direct_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                  <p className="flex justify-between text-[var(--color-tertiary)]">
                    <span>GST ({formData.gst_percent}%)</span>
                    <span>₹{(calculateEstimatedPrice() - parseFloat(formData.direct_price)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                  <p className="flex justify-between border-t border-[var(--color-tertiary-soft)] pt-1 text-lg font-semibold text-[var(--color-ink)]">
                    <span>Final Price</span>
                    <span>₹{calculateEstimatedPrice().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                </div>
                <p className="text-xs text-[var(--color-tertiary)] mt-1">
                  Purity, weight, and making charge are ignored. Clear the Direct Price field to use automatic metal pricing.
                </p>
              </div>
            ) : metalPriceLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (formData.material_type === 'silver' ? silverPrice : goldPrice) ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-quaternary)] mb-1">
                  Estimated Price (Auto-Calculated)
                </p>
                <p className="text-2xl font-semibold text-[var(--color-ink)]">
                  ₹{calculateEstimatedPrice().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[var(--color-tertiary)] mt-1">
                  Based on current {formData.material_type} price: ₹{(formData.material_type === 'silver' ? silverPrice : goldPrice)?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/g
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-error)]">
                {formData.material_type === 'silver' ? 'Silver' : 'Gold'} price unavailable — cannot calculate
              </p>
            )}
          </div>
        </div>


        <div>
          <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
            Offer
          </label>
          <select
            value={formData.offer_id}
            onChange={(e) => setFormData({ ...formData, offer_id: e.target.value })}
            className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
          >
            <option value="">No offer</option>
            {offers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-ink-soft)] mb-1.5 block">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as "draft" | "published" | "archived" })}
            className="h-10 px-3 bg-[var(--color-primary)] border border-[var(--color-tertiary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-ink)] focus:border-[var(--color-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-quaternary)]/20"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <ImageUploader
          urls={imageUrls}
          onChange={setImageUrls}
          disabled={saving}
        />

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
