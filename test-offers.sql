-- Test query to check offer and banner visibility
-- Run this in Supabase SQL Editor to diagnose the issue

-- Check all offers with their status
SELECT 
  id,
  label,
  is_active,
  start_date,
  end_date,
  CASE 
    WHEN is_active = false THEN 'OFFER INACTIVE'
    WHEN start_date > now() THEN 'START DATE IN FUTURE'
    WHEN end_date IS NOT NULL AND end_date <= now() THEN 'END DATE PASSED'
    ELSE 'SHOULD BE VISIBLE'
  END as visibility_status,
  created_at
FROM offers
ORDER BY created_at DESC;

-- Check all offer banners with their offer status
SELECT 
  ob.id,
  ob.offer_id,
  ob.is_active as banner_active,
  ob.display_order,
  o.label,
  o.is_active as offer_active,
  o.start_date,
  o.end_date,
  CASE 
    WHEN ob.is_active = false THEN 'BANNER INACTIVE'
    WHEN o.is_active = false THEN 'OFFER INACTIVE'
    WHEN o.start_date > now() THEN 'OFFER START DATE IN FUTURE'
    WHEN o.end_date IS NOT NULL AND o.end_date <= now() THEN 'OFFER END DATE PASSED'
    ELSE 'SHOULD BE VISIBLE'
  END as visibility_status
FROM offer_banners ob
LEFT JOIN offers o ON ob.offer_id = o.id
ORDER BY ob.display_order;

-- Check products with offers
SELECT 
  p.id,
  p.name,
  p.offer_id,
  p.status,
  o.label,
  o.is_active as offer_active,
  o.start_date,
  o.end_date,
  CASE 
    WHEN p.status != 'published' THEN 'PRODUCT NOT PUBLISHED'
    WHEN o.is_active = false THEN 'OFFER INACTIVE'
    WHEN o.start_date > now() THEN 'OFFER START DATE IN FUTURE'
    WHEN o.end_date IS NOT NULL AND o.end_date <= now() THEN 'OFFER END DATE PASSED'
    ELSE 'SHOULD BE VISIBLE'
  END as visibility_status
FROM products p
LEFT JOIN offers o ON p.offer_id = o.id
WHERE p.offer_id IS NOT NULL
ORDER BY p.updated_at DESC;
