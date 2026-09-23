/**
 * GET /api/admin/analytics — aggregated analytics data
 * Returns pre-aggregated analytics metrics for the dashboard.
 * Supports time-based filtering via query params.
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { unauthorized, serverError } from "@/lib/http";
import { handlePreflight, withCors } from "@/lib/cors";
import { NextRequest, NextResponse } from "next/server";

interface AnalyticsResponse {
  overview: {
    totalProducts: number;
    publishedProducts: number;
    draftProducts: number;
    archivedProducts: number;
    totalOffers: number;
    activeOffers: number;
    totalInquiries: number;
    newInquiries: number;
    contactedInquiries: number;
    resolvedInquiries: number;
    hallmarkCertified: number;
    avgPrice: number;
    availableProducts: number;
    madeToOrderProducts: number;
    soldOutProducts: number;
  };
  visits: {
    totalVisits: number;
    uniquePages: number;
    topPages: Array<{ page_path: string; count: number }>;
    popularProducts: Array<{ product_id: string; count: number; product_name?: string }>;
  };
  trends: {
    dailyVisits: Array<{ date: string; count: number }>;
    weeklyVisits: Array<{ week: string; count: number }>;
    monthlyVisits: Array<{ month: string; count: number }>;
  };
}

export async function GET(req: NextRequest) {
  // Handle preflight request
  const preflight = handlePreflight(req, { origin: '*' });
  if (preflight) return preflight;

  if (!(await requireAdmin(req))) return unauthorized();

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "7d"; // 7d, 30d, 90d

  const supabase = getServiceClient();

  try {
    // Get product stats
    const { data: products } = await supabase
      .from("products")
      .select("id, status, hallmark_certified, price, availability");

    // Get offer stats
    const { data: offers } = await supabase
      .from("offers")
      .select("id, is_active");

    // Get inquiry stats
    const { data: inquiries } = await supabase
      .from("inquiries")
      .select("id, status");

    // Get visit stats
    const { data: visits } = await supabase
      .from("visits")
      .select("id, page_path, product_id, created_at");

    // Calculate overview stats
    const totalProducts = products?.length || 0;
    const publishedProducts = products?.filter(p => p.status === "published").length || 0;
    const draftProducts = products?.filter(p => p.status === "draft").length || 0;
    const archivedProducts = products?.filter(p => p.status === "archived").length || 0;
    const totalOffers = offers?.length || 0;
    const activeOffers = offers?.filter(o => o.is_active).length || 0;
    const totalInquiries = inquiries?.length || 0;
    const newInquiries = inquiries?.filter(i => i.status === "new").length || 0;
    const contactedInquiries = inquiries?.filter(i => i.status === "contacted").length || 0;
    const resolvedInquiries = inquiries?.filter(i => i.status === "resolved").length || 0;
    const hallmarkCertified = products?.filter(p => p.hallmark_certified).length || 0;
    const avgPrice = totalProducts > 0 
      ? products!.reduce((sum, p) => sum + (p.price || 0), 0) / totalProducts 
      : 0;
    const availableProducts = products?.filter(p => p.availability === "available").length || 0;
    const madeToOrderProducts = products?.filter(p => p.availability === "made_to_order").length || 0;
    const soldOutProducts = products?.filter(p => p.availability === "sold").length || 0;

    // Calculate visit stats
    const totalVisits = visits?.length || 0;
    const uniquePages = new Set(visits?.map(v => v.page_path)).size || 0;

    // Top pages
    const pageCounts = new Map<string, number>();
    visits?.forEach(v => {
      pageCounts.set(v.page_path, (pageCounts.get(v.page_path) || 0) + 1);
    });
    const topPages = Array.from(pageCounts.entries())
      .map(([page_path, count]) => ({ page_path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Popular products
    const productCounts = new Map<string, number>();
    visits?.filter(v => v.product_id).forEach(v => {
      productCounts.set(v.product_id!, (productCounts.get(v.product_id!) || 0) + 1);
    });
    
    // Get product names for popular products
    const popularProductIds = Array.from(productCounts.entries())
      .map(([product_id, count]) => ({ product_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(p => p.product_id);

    const { data: popularProductsData } = await supabase
      .from("products")
      .select("id, name")
      .in("id", popularProductIds);

    const productNameMap = new Map(popularProductsData?.map(p => [p.id, p.name]) || []);

    const popularProducts = Array.from(productCounts.entries())
      .map(([product_id, count]) => ({
        product_id,
        count,
        product_name: productNameMap.get(product_id),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate time-based trends
    const now = new Date();
    const daysAgo = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      return d;
    };

    const filteredVisits = visits?.filter(v => {
      const visitDate = new Date(v.created_at);
      if (period === "7d") return visitDate >= daysAgo(7);
      if (period === "30d") return visitDate >= daysAgo(30);
      if (period === "90d") return visitDate >= daysAgo(90);
      return true;
    }) || [];

    // Daily visits
    const dailyVisitsMap = new Map<string, number>();
    filteredVisits.forEach(v => {
      const date = new Date(v.created_at).toISOString().split('T')[0];
      dailyVisitsMap.set(date, (dailyVisitsMap.get(date) || 0) + 1);
    });
    const dailyVisits = Array.from(dailyVisitsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Weekly visits
    const weeklyVisitsMap = new Map<string, number>();
    filteredVisits.forEach(v => {
      const date = new Date(v.created_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      weeklyVisitsMap.set(weekKey, (weeklyVisitsMap.get(weekKey) || 0) + 1);
    });
    const weeklyVisits = Array.from(weeklyVisitsMap.entries())
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Monthly visits
    const monthlyVisitsMap = new Map<string, number>();
    filteredVisits.forEach(v => {
      const date = new Date(v.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyVisitsMap.set(monthKey, (monthlyVisitsMap.get(monthKey) || 0) + 1);
    });
    const monthlyVisits = Array.from(monthlyVisitsMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const response: AnalyticsResponse = {
      overview: {
        totalProducts,
        publishedProducts,
        draftProducts,
        archivedProducts,
        totalOffers,
        activeOffers,
        totalInquiries,
        newInquiries,
        contactedInquiries,
        resolvedInquiries,
        hallmarkCertified,
        avgPrice,
        availableProducts,
        madeToOrderProducts,
        soldOutProducts,
      },
      visits: {
        totalVisits,
        uniquePages,
        topPages,
        popularProducts,
      },
      trends: {
        dailyVisits,
        weeklyVisits,
        monthlyVisits,
      },
    };

    const jsonResponse = NextResponse.json({ data: response });
    return withCors(jsonResponse, req, { origin: '*' });
  } catch (error) {
    console.error("Analytics aggregation error:", error);
    const errorResponse = serverError(error);
    return withCors(errorResponse, req, { origin: '*' });
  }
}
