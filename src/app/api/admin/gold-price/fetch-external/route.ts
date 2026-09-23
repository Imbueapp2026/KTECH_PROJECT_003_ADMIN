/**
 * POST /api/admin/gold-price/fetch-external - Fetch gold price from external API
 * Uses a free gold price API (metal-api.com or similar)
 * Falls back to cached price if fetch fails
 */
import { getServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
async function fetchGoldPriceFromAPI(): Promise<{ price: number; source: string; source_url: string } | null> {
  try {
    // Using metal-api.com for gold prices
    // Note: The demo key is non-functional (401 Unauthorized). A real API key is needed.
    // The API returns XAU (gold) price per troy ounce in the specified base currency
    // We request base=INR to get price in INR per troy ounce, then convert to per gram
    const response = await fetch('https://metals-api.com/api/latest?access_key=demo&base=INR&symbols=XAU', {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.rates && data.rates.XAU) {
      // XAU is price per troy ounce in INR (since base=INR)
      // Convert to per gram: 1 troy ounce = 31.1035 grams
      const pricePerGram = data.rates.XAU / 31.1035;
      
      return {
        price: Math.round(pricePerGram * 100) / 100, // Round to 2 decimal places
        source: 'api',
        source_url: 'https://metals-api.com'
      };
    }
    
    throw new Error('Invalid API response');
  } catch (error) {
    console.error('Failed to fetch gold price from API:', error);
    return null;
  }
}

export async function POST() {
  try {
    const supabase = getServiceClient();
    
    // Get the last cached price
    const { data: lastPrice, error: lastPriceError } = await supabase
      .from('gold_prices')
      .select('price_per_gram')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (lastPriceError) {
      console.error("Query error:", lastPriceError);
      return NextResponse.json(
        { error: "Failed to query last price", details: lastPriceError },
        { status: 500 }
      );
    }
    
    // Try to fetch from external API
    const apiResult = await fetchGoldPriceFromAPI();
    
    let finalPrice: number;
    let finalSource: string;
    let finalSourceUrl: string | null;
    
    if (apiResult) {
      // Relative sanity check
      if (lastPrice) {
        const percentDiff = Math.abs((apiResult.price - lastPrice.price_per_gram) / lastPrice.price_per_gram) * 100;
        if (percentDiff > 20) {
          console.warn(`Gold price change too large: ${percentDiff.toFixed(1)}%. Using cached price.`);
          finalPrice = lastPrice.price_per_gram;
          finalSource = 'fallback';
          finalSourceUrl = null;
        } else {
          finalPrice = apiResult.price;
          finalSource = apiResult.source;
          finalSourceUrl = apiResult.source_url;
        }
      } else {
        finalPrice = apiResult.price;
        finalSource = apiResult.source;
        finalSourceUrl = apiResult.source_url;
      }
    } else {
      if (lastPrice) {
        finalPrice = lastPrice.price_per_gram;
        finalSource = 'fallback';
        finalSourceUrl = null;
      } else {
        return NextResponse.json(
          { error: "No cached price and API failed" },
          { status: 503 }
        );
      }
    }
    
    // Insert the final price - try minimal insert first
    const { error } = await supabase
      .from('gold_prices')
      .insert({
        price_per_gram: finalPrice,
        source: finalSource
      });
    
    if (error) {
      console.error("Insert failed:", error);
      return NextResponse.json(
        { error: "Insert failed", details: error },
        { status: 500 }
      );
    }
    
    // Get most recent price - use maybeSingle instead of single to avoid error
    const { data: latestPrice } = await supabase
      .from('gold_prices')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    return NextResponse.json({
      id: latestPrice?.id,
      price_per_gram: finalPrice,
      updated_at: new Date().toISOString(),
      source: finalSource,
      source_url: finalSourceUrl,
      fallback: finalSource === 'fallback'
    });
  } catch (error) {
    console.error("Error in POST:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
