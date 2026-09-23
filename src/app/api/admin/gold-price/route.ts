/**
 * GET /api/admin/gold-price - Get current gold price
 * POST /api/admin/gold-price - Set current gold price (manual override)
 */
import { getServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = getServiceClient();
    
    // Get the most recent gold price by timestamp
    const { data, error } = await supabase
      .from('gold_prices')
      .select('price_per_gram, updated_at, source')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error || !data) {
      console.log("No gold price found in database, using fallback");
      // Return a fallback price instead of null to prevent "Gold price unavailable" error
      return NextResponse.json({
        price_per_gram: 6500,
        updated_at: new Date().toISOString(),
        source: 'fallback'
      }, { 
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } 
      });
    }
    
    return NextResponse.json({
      price_per_gram: data.price_per_gram,
      updated_at: data.updated_at,
      source: data.source
    }, { 
      headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800' } 
    });
  } catch (error) {
    console.log("Gold price API error, using fallback:", error);
    return NextResponse.json({
      price_per_gram: 6500,
      updated_at: new Date().toISOString(),
      source: 'fallback'
    }, { 
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } 
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const price_per_gram = body.price_per_gram;
    const source = body.source || 'manual';
    
    // Validate price is a number and positive
    if (!price_per_gram || typeof price_per_gram !== 'number' || isNaN(price_per_gram) || price_per_gram <= 0) {
      console.error(`Invalid price_per_gram: ${price_per_gram}`);
      return NextResponse.json(
        { error: "Invalid price_per_gram: must be a positive number" },
        { status: 400 }
      );
    }
    
    const supabase = getServiceClient();
    
    // Get previous gold price (most recent) to detect significant decreases
    let previousPrice = null;
    let priceDecreasePercent = 0;
    
    try {
      const { data: currentPrice } = await supabase
        .from('gold_prices')
        .select('price_per_gram')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (currentPrice) {
        previousPrice = currentPrice.price_per_gram;
        if (price_per_gram < previousPrice) {
          priceDecreasePercent = ((previousPrice - price_per_gram) / previousPrice) * 100;
          
          // Warn about significant decreases (>20%)
          if (priceDecreasePercent > 20) {
            console.warn(`Significant gold price decrease: ${priceDecreasePercent.toFixed(1)}% from ₹${previousPrice} to ₹${price_per_gram}`);
          }
        }
      }
    } catch (error) {
      console.error("Failed to get previous gold price:", error);
    }
    
    // Insert new gold price row (always insert, never overwrite)
    console.log("Attempting to insert gold price:", { price_per_gram, source });
    const { data, error } = await supabase
      .from('gold_prices')
      .insert({
        price_per_gram: price_per_gram,
        source: source
      })
      .select()
      .single();
    console.log("Insert result:", { data, error });
    
    if (error) {
      console.error("Failed to insert gold price:", error);
      console.error("Error details:", JSON.stringify(error));
      return NextResponse.json(
        { error: "Failed to save gold price to database", details: error },
        { status: 500 }
      );
    }
    
    // Fetch the current silver price to pass to recalculate_all_products_with_missing_data
    let silverPrice = 0;
    try {
      const { data: silverData } = await supabase
        .from('silver_prices')
        .select('price_per_gram')
        .eq('is_current', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      silverPrice = silverData?.price_per_gram || 0;
    } catch (err) {
      console.error("Failed to fetch silver price for recalculation fallback:", err);
    }

    // Automatically recalculate all product prices with the new gold price
    console.log("Recalculating all gold product prices with new gold price:", price_per_gram);
    const { data: recalcData, error: recalcError } = await supabase
      .rpc('recalculate_all_products_with_missing_data', {
        p_gold_price_per_gram: price_per_gram,
        p_silver_price_per_gram: silverPrice,
        p_material_type: 'gold'
      });
    
    let recalcResult = { updated_count: 0, skipped_count: 0 };
    if (recalcError) {
      console.error("Failed to recalculate prices:", recalcError);
    } else {
      recalcResult = typeof recalcData === 'string' ? JSON.parse(recalcData) : recalcData;
      console.log("Recalculation result:", recalcResult);
    }
    
    return NextResponse.json({
      success: true,
      price_per_gram,
      source,
      updated_at: new Date().toISOString(),
      previous_price: previousPrice,
      price_decrease_percent: priceDecreasePercent > 0 ? priceDecreasePercent : null,
      recalculation: {
        updated_count: recalcResult.updated_count || 0,
        skipped_count: recalcResult.skipped_count || 0
      }
    });
  } catch (error) {
    console.error("Error in POST:", error);
    console.error("Error details:", JSON.stringify(error));
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
