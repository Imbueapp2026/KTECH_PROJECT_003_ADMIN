alter table public.products
  add column if not exists offer_price numeric null
  check (offer_price is null or offer_price >= 0);

--Enable pg_cron separately if desired; this schedule is intentionally disabled.
--    select cron.schedule(
  -- 'clear-inactive-or-ended-offer-prices',
  -- '0 0 * * *',   $job$
--     update public.products p
--     set offer_price = null
--     where p.offer_price is not null
--       and exists (
--         select 1
--         from public.offers o
--         where o.id = p.offer_id
--           and (o.is_active = false or (o.end_date is not null and o.end_date < current_date))
--       );
--   $job$
-- );

-- Offer banner images use product-images/offer-banners/{offer_id}/...
-- Admin writes are performed by Firebase-authenticated server routes using the service role.
update storage.buckets
set public = true
where id = 'product-images';

drop policy if exists "offer banner public read" on storage.objects;
create policy "offer banner public read"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'offer-banners'
);

drop policy if exists "offer banner service role insert" on storage.objects;
create policy "offer banner service role insert"
on storage.objects
for insert
to service_role
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'offer-banners'
);

drop policy if exists "offer banner service role update" on storage.objects;
create policy "offer banner service role update"
on storage.objects
for update
to service_role
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'offer-banners'
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'offer-banners'
);

drop policy if exists "offer banner service role delete" on storage.objects;
create policy "offer banner service role delete"
on storage.objects
for delete
to service_role
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'offer-banners'
);

create or replace function public.apply_offer_prices(p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  updated_count integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'p_items must be a JSON array';
  end if;

  update public.products as product
  set offer_id = item.offer_id,
      offer_price = item.offer_price,
      updated_at = now()
  from jsonb_to_recordset(p_items) as item(
    id uuid,
    offer_id uuid,
    offer_price numeric
  )
  where product.id = item.id;

  get diagnostics updated_count = row_count;
  if updated_count <> jsonb_array_length(p_items) then
    raise exception 'Offer assignment matched % products but received % items',
      updated_count, jsonb_array_length(p_items);
  end if;

  return updated_count;
end;
$$;

revoke all on function public.apply_offer_prices(jsonb) from public, anon, authenticated;
grant execute on function public.apply_offer_prices(jsonb) to service_role;