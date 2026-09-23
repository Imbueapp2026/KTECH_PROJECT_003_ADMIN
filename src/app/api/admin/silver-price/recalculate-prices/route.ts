/**
 * POST /api/admin/silver-price/recalculate-prices - Recalculate prices for ALL products
 * This is called automatically when silver price is updated
 * Now handles products with missing data gracefully and returns skipped products
 */
import { getServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { silver_price_per_gram } = body;
    
    if (!silver_price_per_gram || typeof silver_price_per_gram !== 'number' || silver_price_per_gram <= 0) {
      return NextResponse.json(
        { error: "Invalid silver_price_per_gram" },
        { status: 400 }
      );
    }
    
    const supabase = getServiceClient();
    
    // Fetch the current gold price to pass to recalculate_all_products_with_missing_data
    const { data: goldData } = await supabase
      .from('gold_prices')
      .select('price_per_gram')
      .eq('is_current', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
      
    const goldPrice = goldData?.price_per_gram || 0;
    
    // Recalculate ALL products (not just auto-priced ones)
    const { data, error } = await supabase
      .rpc('recalculate_all_products_with_missing_data', {
        p_gold_price_per_gram: goldPrice,
        p_silver_price_per_gram: silver_price_per_gram,
        p_material_type: 'silver'
      });
    
    if (error) {
      console.error("Error recalculating prices:", error);
      return NextResponse.json(
        { error: "Failed to recalculate prices" },
        { status: 500 }
      );
    }
    
    // Parse the JSON result from the function
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    return NextResponse.json({
      success: true,
      updated_count: result.updated_count || 0,
      updated_products: result.updated_products || [],
      skipped_count: result.skipped_count || 0,
      skipped_products: result.skipped_products || []
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
