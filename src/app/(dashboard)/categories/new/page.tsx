"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export default function NewCategoryPage() {
  const router = useRouter();
  const { push } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await api.post<{ id?: string; data?: { id?: string } }>("/api/admin/categories", { name, slug });
      const categoryId = res?.id || res?.data?.id;
      push("Category created successfully.", "success");
      if (categoryId) {
        router.push(`/categories/${categoryId}`);
      } else {
        router.push("/categories");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create category.";
      setError(msg);
      push(msg, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl flex flex-col gap-6">
      <header>
        <Link href="/categories" className="text-sm text-[var(--color-tertiary)] hover:text-[var(--color-ink)]">
          ← Back to Categories
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Add New Category
        </h1>
      </header>

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-soft)] border border-[var(--color-error)]/30 rounded-[var(--radius-md)] px-4 py-3" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input
          label="Category Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bridal Sets"
          required
        />

        <p className="text-xs text-[var(--color-tertiary)] -mt-4">
          The icon is automatically generated from the category name initial. You can update it later from the category detail page.
        </p>

        <div className="flex items-center gap-3 pt-4 border-t border-[var(--color-tertiary-soft)]">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create Category"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
