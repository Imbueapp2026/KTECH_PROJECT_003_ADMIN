"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { AuthGate } from "@/components/shell/AuthGate";

interface Product {
  id: string;
  name: string;
  image_urls: string[];
  price: number;
  is_limited: boolean;
  banner_priority: number;
  status: string;
  availability: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon_svg: string;
  is_featured: boolean;
  banner_priority: number;
}

export default function BannersPage() {
  return (
    <AuthGate>
      <BannerManagementContent />
    </AuthGate>
  );
}

function BannerManagementContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"products" | "categories">("products");

  useEffect(() => {
    async function loadData() {
      try {
        const response = await api.get<{ products: Product[]; categories: Category[] }>("/api/admin/banners");
        setProducts(response.products);
        setCategories(response.categories);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load banner data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleProductLimited = async (productId: string, currentStatus: boolean) => {
    try {
      await api.post("/api/admin/banners", {
        type: "product",
        id: productId,
        is_limited: !currentStatus,
      });
      setProducts((current) =>
        current.map((p) => (p.id === productId ? { ...p, is_limited: !currentStatus } : p)),
      );
    } catch (err) {
      console.error("Failed to update product:", err);
    }
  };

  const toggleCategoryFeatured = async (categoryId: string, currentStatus: boolean) => {
    try {
      await api.post("/api/admin/banners", {
        type: "category",
        id: categoryId,
        is_featured: !currentStatus,
      });
      setCategories((current) =>
        current.map((c) => (c.id === categoryId ? { ...c, is_featured: !currentStatus } : c)),
      );
    } catch (err) {
      console.error("Failed to update category:", err);
    }
  };

  const updatePriority = async (type: "product" | "category", id: string, priority: number) => {
    try {
      await api.post("/api/admin/banners", {
        type,
        id,
        banner_priority: priority,
      });
      if (type === "product") {
        setProducts((current) =>
          current.map((p) => (p.id === id ? { ...p, banner_priority: priority } : p)),
        );
      } else {
        setCategories((current) =>
          current.map((c) => (c.id === id ? { ...c, banner_priority: priority } : c)),
        );
      }
    } catch (err) {
      console.error("Failed to update priority:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Banner Management</h1>
      
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab("products")}
          className={`pb-2 px-4 ${activeTab === "products" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
        >
          Products
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`pb-2 px-4 ${activeTab === "categories" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
        >
          Categories
        </button>
      </div>

      {activeTab === "products" ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Limited Products</h2>
          <p className="text-sm text-gray-600 mb-4">
            Mark products as &quot;Limited&quot; to appear in the banner. Higher priority values appear first.
          </p>
          {products.map((product) => (
            <div key={product.id} className="bg-white border rounded-lg p-4 flex items-center gap-4">
              {product.image_urls?.[0] && (
                <div className="relative h-16 w-16 overflow-hidden rounded">
                  <Image
                    src={product.image_urls[0]}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium">{product.name}</h3>
                <p className="text-sm text-gray-600">₹{product.price}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    product.status === "published" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {product.status}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    product.availability === "available" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {product.availability}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm">Priority:</label>
                  <input
                    type="number"
                    value={product.banner_priority}
                    onChange={(e) => updatePriority("product", product.id, Number.parseInt(e.target.value) || 0)}
                    className="w-16 border rounded px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={() => toggleProductLimited(product.id, product.is_limited)}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    product.is_limited
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {product.is_limited ? "Limited" : "Mark Limited"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Featured Categories</h2>
          <p className="text-sm text-gray-600 mb-4">
            Mark categories as &quot;Featured&quot; to appear in the banner. Higher priority values appear first.
          </p>
          {categories.map((category) => (
            <div key={category.id} className="bg-white border rounded-lg p-4 flex items-center gap-4">
              {category.icon_svg && (
                <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded">
                  <div dangerouslySetInnerHTML={{ __html: category.icon_svg }} className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium">{category.name}</h3>
                <p className="text-sm text-gray-600">/{category.slug}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm">Priority:</label>
                  <input
                    type="number"
                    value={category.banner_priority}
                    onChange={(e) => updatePriority("category", category.id, Number.parseInt(e.target.value) || 0)}
                    className="w-16 border rounded px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={() => toggleCategoryFeatured(category.id, category.is_featured)}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    category.is_featured
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {category.is_featured ? "Featured" : "Mark Featured"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
