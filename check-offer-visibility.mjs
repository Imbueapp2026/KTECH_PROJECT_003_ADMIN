/**
 * Diagnostic script to check offer and banner visibility
 * Run with: node check-offer-visibility.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

// Load environment variables manually
const envPath = path.join(process.cwd(), '.env.local');
const envPathAlt = path.join(process.cwd(), '.env');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch (e) {
  try {
    envContent = readFileSync(envPathAlt, 'utf-8');
  } catch (e2) {
    console.error('No .env.local or .env file found');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY as environment variables or create a .env file');
    console.error('Or run the SQL queries in test-offers.sql directly in Supabase SQL Editor');
    process.exit(1);
  }
}
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SECRET_KEY; // Use service role for full access

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('SUPABASE_SECRET_KEY:', supabaseKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOffers() {
  console.log('\n=== CHECKING OFFERS ===\n');
  
  const { data: offers, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching offers:', error);
    return;
  }
  
  const now = new Date();
  
  offers.forEach(offer => {
    const startDate = offer.start_date ? new Date(offer.start_date) : null;
    const endDate = offer.end_date ? new Date(offer.end_date) : null;
    
    let status = '✅ SHOULD BE VISIBLE';
    let issues = [];
    
    if (!offer.is_active) {
      status = '❌ OFFER INACTIVE';
      issues.push('is_active = false');
    }
    
    if (startDate && startDate > now) {
      status = '❌ START DATE IN FUTURE';
      issues.push(`start_date: ${startDate.toISOString()} (future)`);
    }
    
    if (endDate && endDate <= now) {
      status = '❌ END DATE PASSED';
      issues.push(`end_date: ${endDate.toISOString()} (past)`);
    }
    
    console.log(`\nOffer: ${offer.label}`);
    console.log(`  ID: ${offer.id}`);
    console.log(`  Status: ${status}`);
    if (issues.length > 0) {
      console.log(`  Issues: ${issues.join(', ')}`);
    }
    console.log(`  is_active: ${offer.is_active}`);
    console.log(`  start_date: ${offer.start_date || 'null'}`);
    console.log(`  end_date: ${offer.end_date || 'null'}`);
  });
}

async function checkOfferBanners() {
  console.log('\n=== CHECKING OFFER BANNERS ===\n');
  
  const { data: banners, error } = await supabase
    .from('offer_banners')
    .select(`
      *,
      offers (*)
    `)
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error('Error fetching offer banners:', error);
    return;
  }
  
  const now = new Date();
  
  banners.forEach(banner => {
    const offer = banner.offers;
    let status = '✅ SHOULD BE VISIBLE';
    let issues = [];
    
    if (!banner.is_active) {
      status = '❌ BANNER INACTIVE';
      issues.push('banner.is_active = false');
    }
    
    if (offer) {
      if (!offer.is_active) {
        status = '❌ OFFER INACTIVE';
        issues.push('offer.is_active = false');
      }
      
      const startDate = offer.start_date ? new Date(offer.start_date) : null;
      const endDate = offer.end_date ? new Date(offer.end_date) : null;
      
      if (startDate && startDate > now) {
        status = '❌ OFFER START DATE IN FUTURE';
        issues.push(`offer.start_date: ${startDate.toISOString()} (future)`);
      }
      
      if (endDate && endDate <= now) {
        status = '❌ OFFER END DATE PASSED';
        issues.push(`offer.end_date: ${endDate.toISOString()} (past)`);
      }
    } else {
      status = '⚠️  NO OFFER LINKED';
      issues.push('banner has no associated offer');
    }
    
    console.log(`\nBanner ID: ${banner.id}`);
    console.log(`  Status: ${status}`);
    if (issues.length > 0) {
      console.log(`  Issues: ${issues.join(', ')}`);
    }
    console.log(`  banner.is_active: ${banner.is_active}`);
    console.log(`  offer_id: ${banner.offer_id}`);
    console.log(`  offer.label: ${offer?.label || 'null'}`);
    console.log(`  display_order: ${banner.display_order}`);
  });
}

async function checkProductsWithOffers() {
  console.log('\n=== CHECKING PRODUCTS WITH OFFERS ===\n');
  
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      *,
      offers (*)
    `)
    .not('offer_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error fetching products with offers:', error);
    return;
  }
  
  const now = new Date();
  
  products.forEach(product => {
    const offer = product.offers;
    let status = '✅ SHOULD BE VISIBLE';
    let issues = [];
    
    if (product.status !== 'published') {
      status = '❌ PRODUCT NOT PUBLISHED';
      issues.push(`product.status = ${product.status}`);
    }
    
    if (offer) {
      if (!offer.is_active) {
        status = '❌ OFFER INACTIVE';
        issues.push('offer.is_active = false');
      }
      
      const startDate = offer.start_date ? new Date(offer.start_date) : null;
      const endDate = offer.end_date ? new Date(offer.end_date) : null;
      
      if (startDate && startDate > now) {
        status = '❌ OFFER START DATE IN FUTURE';
        issues.push(`offer.start_date: ${startDate.toISOString()} (future)`);
      }
      
      if (endDate && endDate <= now) {
        status = '❌ OFFER END DATE PASSED';
        issues.push(`offer.end_date: ${endDate.toISOString()} (past)`);
      }
    }
    
    console.log(`\nProduct: ${product.name}`);
    console.log(`  Status: ${status}`);
    if (issues.length > 0) {
      console.log(`  Issues: ${issues.join(', ')}`);
    }
    console.log(`  product.status: ${product.status}`);
    console.log(`  offer.label: ${offer?.label || 'null'}`);
  });
}

async function main() {
  console.log('=== OFFER VISIBILITY DIAGNOSTIC ===');
  console.log(`Current time: ${new Date().toISOString()}\n`);
  
  await checkOffers();
  await checkOfferBanners();
  await checkProductsWithOffers();
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
}

main().catch(console.error);
