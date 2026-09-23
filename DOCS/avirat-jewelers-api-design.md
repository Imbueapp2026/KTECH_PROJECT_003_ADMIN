# Avirat Jewelers — API & System Design Document

**Version:** 1.0
**Scope:** Product/Category/Inquiry API surface across the admin app and public app, sharing one Supabase backend, in a monorepo.

---

## 1. Architecture Overview

**Monorepo structure**

```
avirat-jewelers/
├── apps/
│   ├── admin/          → admin.avirat-jewelers.com (control plane)
│   └── public/         → avirat-jewelers.com (display + inquiry capture)
├── packages/
│   ├── shared-types/    → Product, Category, Inquiry, Offer TS types
│   ├── supabase-client/ → typed Supabase client factory + shared query helpers
│   └── ui/               → shared design tokens (optional, if visual overlap emerges)
├── turbo.json
└── package.json
```

**Core principle:** Admin is the sole write authority for catalog data. Public app is read-only on catalog data, write-only (insert) on inquiries. Supabase Realtime is the notification layer between the two — no custom webhook or polling API is needed to "tell" the public app that a product changed.

**Data flow at a glance**

```
Admin Form ──POST──▶ Admin API Route ──▶ Supabase (products, storage)
                                              │
                                              │ Realtime INSERT/UPDATE event
                                              ▼
                                     Public App (subscribed client)
                                              │
                                              │ GET /api/products/[id]  (hydrate full detail)
                                              ▼
                                     Card built + placed in Catalog Grid + BentoGrid "New Arrivals"
```

---

## 2. Data Model (shared package: `shared-types`)

### 2.1 `products` table

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK, default `gen_random_uuid()`) | |
| `name` | `text` | required |
| `category_id` | `uuid` (FK → categories.id) | required |
| `description` | `text` | required |
| `hallmark_certified` | `boolean` | default `false` |
| `availability` | `enum('available','made_to_order','sold')` | default `'available'` |
| `is_offer` | `boolean` | default `false` |
| `offer_label` | `text` (nullable) | e.g. "Festive Special"; only meaningful when `is_offer = true` |
| `status` | `enum('draft','published','archived')` | default `'draft'` — see §5 state machine |
| `image_urls` | `text[]` | 1–4 Supabase Storage public URLs, ordered |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | trigger-updated on row change |

### 2.2 `categories` table

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | |
| `name` | `text` | required, unique |
| `icon_url` | `text` | Supabase Storage URL |
| `created_at` | `timestamptz` | |

### 2.3 `inquiries` table

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | |
| `name` | `text` | required |
| `phone` | `text` | required |
| `email` | `text` | nullable |
| `message` | `text` | nullable |
| `product_id` | `uuid` (FK → products.id, nullable) | set if inquiry originated from a product page |
| `status` | `enum('new','contacted','resolved')` | default `'new'` |
| `created_at` | `timestamptz` | |

### 2.4 `visits` table

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | |
| `page_path` | `text` | |
| `product_id` | `uuid` (nullable) | |
| `created_at` | `timestamptz` | |

---

## 3. Row Level Security (RLS) Design

| Table | Public app (anon key) | Admin app (service role / authenticated) |
|---|---|---|
| `products` | `SELECT` where `status = 'published'` only | full `SELECT`/`INSERT`/`UPDATE`/`DELETE` |
| `categories` | `SELECT` all | full CRUD |
| `inquiries` | `INSERT` only | `SELECT`/`UPDATE` (status changes) |
| `visits` | `INSERT` only | `SELECT` |

Admin app authenticates via Firebase Auth on its own side; Supabase access from admin's API routes uses the **service role key**, called only from server-side API routes — never exposed to the admin browser client. This means Supabase RLS doesn't need to understand Firebase identities; the admin app's own auth gate is the trust boundary, and its server routes are the only thing holding the service key.

---

## 4. API Surface

### 4.1 Admin app (`apps/admin`) — write endpoints

#### `POST /api/admin/products`
Creates a new product.

**Request body**
```json
{
  "name": "string",
  "category_id": "uuid",
  "description": "string",
  "hallmark_certified": "boolean",
  "availability": "available | made_to_order | sold",
  "is_offer": "boolean",
  "offer_label": "string | null",
  "images": ["base64 or multipart file[]"]
}
```

**Behavior**
1. Validate payload (required fields, image count 1–4).
2. Insert row with `status: 'draft'`.
3. Upload each image to Supabase Storage bucket `product-images/{product_id}/`.
4. On successful upload of all images, `UPDATE products SET status = 'published' WHERE id = ...`.
5. If any image upload fails, leave `status = 'draft'` and return a partial-failure response so the admin UI can retry image upload without re-submitting the whole form.

**Response**
```json
{ "id": "uuid", "status": "published | draft", "errors": [] }
```

#### `PATCH /api/admin/products/[id]`
Edits an existing product. Same body shape, partial update supported. Does not change `status` unless explicitly instructed (see §5).

#### `DELETE /api/admin/products/[id]`
Sets `status: 'archived'` (soft delete — never hard-deletes, to preserve inquiry history referencing the product).

#### `POST /api/admin/categories`, `PATCH /api/admin/categories/[id]`
Same shape pattern, simpler payload (name, icon upload).

#### `GET /api/admin/inquiries`, `PATCH /api/admin/inquiries/[id]`
List/filter inquiries; update status (`new → contacted → resolved`).

### 4.2 Public app (`apps/public`) — read + inquiry endpoints

#### `GET /api/products`
Catalog listing, supports query params: `category`, `sort` (excluding price-based sort, since price doesn't exist in schema), `offer=true`.
Used for SSR initial page load — the realtime subscription takes over after mount for live updates.

#### `GET /api/products/[id]`
Full product detail including joined category (name, icon). Used both by the product detail page and by the realtime handler to hydrate a newly-published product's full data before building its card.

#### `POST /api/inquiries`
Public contact/booking form submission. Inserts into `inquiries`. No auth required; rate-limited to prevent spam (see §7).

#### `POST /api/visits`
Fire-and-forget visit tracking beacon.

### 4.3 Realtime subscription (public app, client-side — not a REST endpoint)

```ts
supabase
  .channel('products-feed')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'products', filter: 'status=eq.published' },
    (payload) => handleNewProduct(payload.new.id)
  )
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'products', filter: 'status=eq.published' },
    (payload) => handleProductUpdate(payload.new.id)
  )
  .subscribe()
```

`handleNewProduct` calls `GET /api/products/[id]`, builds the Card component client-side, prepends it into catalog grid state and into the BentoGrid "New Arrivals" slice.

---

## 5. Product Status State Machine

```
        create (images uploading)
              │
              ▼
          [draft] ──── image upload fails ──── (stays draft, admin retries)
              │
       all images uploaded
              │
              ▼
        [published] ◀──────────────┐
              │                     │ admin un-archives
       admin archives               │
              │                     │
              ▼                     │
        [archived] ──────────────────┘
```

- **`draft → published`**: automatic, system-driven, once all images are confirmed uploaded. Not a manual admin action.
- **Edits to a published product**: apply instantly (no separate "publish" step) — matches the client's expectation of live editing already spec'd ("changes reflected live on the site via realtime data"). If a two-step review is wanted later, this is the place to add a `pending_review` status — **flagging as open, not yet decided**.
- **`published → archived`**: soft delete via admin Delete action. Archived products vanish from public queries (RLS/filter excludes non-published) but remain in DB for inquiry history integrity.

---

## 6. Task Breakdown (build order)

### Phase A — Foundation
- [ ] Initialize monorepo (Turborepo), `apps/admin`, `apps/public`, `packages/shared-types`, `packages/supabase-client`
- [ ] Define Supabase schema (migrations for `products`, `categories`, `inquiries`, `visits`)
- [ ] Write RLS policies per §3
- [ ] Set up Storage buckets: `product-images`, `category-icons`
- [ ] Generate/hand-write shared TS types matching schema, exported from `shared-types`

### Phase B — Admin: Auth + Shell
- [ ] Firebase Auth login page
- [ ] Dashboard shell (sidebar: Overview / Inquiries / Products / Categories / Analytics)
- [ ] Server-side auth guard on all `/api/admin/*` routes (verify Firebase session before touching Supabase service key)

### Phase C — Admin: Products CRUD
- [ ] Add Product form (all fields from §2.1) + multipart image upload UI (1–4 images)
- [ ] `POST /api/admin/products` implementation incl. draft→published flip
- [ ] Product list/table view with search + category filter
- [ ] Edit Product form (pre-filled), `PATCH /api/admin/products/[id]`
- [ ] Archive action, `DELETE /api/admin/products/[id]`

### Phase D — Admin: Categories CRUD
- [ ] Add/edit category form (name + icon upload)
- [ ] Category list view

### Phase E — Admin: Inquiries + Overview
- [ ] Inquiries table, status update action
- [ ] Overview dashboard: inquiry counts, recent inquiries widget

### Phase F — Public: Read API + Realtime
- [ ] `GET /api/products`, `GET /api/products/[id]` implementation
- [ ] Realtime channel subscription + handler wiring
- [ ] Catalog grid card injection logic
- [ ] BentoGrid "New Arrivals" slice wiring

### Phase G — Public: Inquiry Capture
- [ ] Inquiry form UI, `POST /api/inquiries`
- [ ] Visit tracking beacon, `POST /api/visits`

### Phase H — Admin: Analytics (lower priority)
- [ ] Basic visit count aggregation view

---

## 7. Open Design Questions

1. **Draft→published review step**: does the client want a manual "Publish" button, or is automatic-on-image-upload-complete correct? (Currently designed as automatic.)
2. **Inquiry spam protection**: rate-limit by IP, CAPTCHA, or honeypot field on `POST /api/inquiries`? Needs a decision before public launch.
3. **Image processing**: are uploaded images resized/optimized server-side (e.g. via a Supabase Edge Function or admin-side sharp processing) before storage, or stored as-is? Affects load performance on the public catalog.
4. **Offer expiry**: does `is_offer` / `offer_label` need a start/end date, or is it purely manual on/off with no auto-expiry?

---

## 8. Non-Functional Notes

- **No price data anywhere in schema** — confirmed design decision, not an oversight; do not reintroduce price fields even for internal admin-only use, since the client's decision was to drop pricing from the system entirely, not just hide it from public view.
- **Service role key** must never be bundled into any client-side JS — confirm build tooling doesn't leak it into the admin app's browser bundle.
- **Realtime channel scaling**: fine at this store's expected traffic volume; if catalog grows very large, consider filtering the subscription further (e.g. by category) rather than one global channel.
