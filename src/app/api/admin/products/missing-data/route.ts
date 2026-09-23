/**
 * GET /api/admin/products/missing-data - Returns products with missing gold pricing data
 * This is used to show alerts on the dashboard about products that need attention
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    if (!(await requireAdmin(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();

    // Query for products with missing required gold pricing fields
    const { data, error } = await supabase
      .from("products")
      .select("id, name, purity_carats, weight_grams, making_charge_type, making_charge_percent, making_charge_flat")
      .or("purity_carats.is.null,weight_grams.is.null,weight_grams.lte.0,making_charge_type.is.null")
      .in("status", ["draft", "published"]); // Only active products

    if (error) {
      console.error("Error fetching products with missing data:", error);
      return NextResponse.json(
        { error: "Failed to fetch products with missing data" },
        { status: 500 }
      );
    }

    // Process each product to identify which fields are missing
    const productsWithMissingFields = (data || []).map((product: Record<string, unknown>) => {
      const missingFields: string[] = [];

      if (!product.purity_carats) {
        missingFields.push("purity_carats");
      }

      if (!product.weight_grams || (product.weight_grams as number) <= 0) {
        missingFields.push("weight_grams");
      }

      if (!product.making_charge_type) {
        missingFields.push("making_charge_type");
      } else if (product.making_charge_type === "percent" && (!product.making_charge_percent || (product.making_charge_percent as number) < 0)) {
        missingFields.push("making_charge_percent");
      } else if (product.making_charge_type === "flat" && (!product.making_charge_flat || (product.making_charge_flat as number) < 0)) {
        missingFields.push("making_charge_flat");
      }

      return {
        id: product.id,
        name: product.name,
        missingFields,
      };
    }).filter((product: { missingFields: string[] }) => product.missingFields.length > 0);

    return NextResponse.json({
      count: productsWithMissingFields.length,
      products: productsWithMissingFields,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
