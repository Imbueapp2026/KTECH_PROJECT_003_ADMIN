# Avirat Jewelers — Product Requirements Document (PRD)

**Version:** 1.0
**Status:** Draft, pre-build
**Owner:** Kevsi (developer), Client: Avirat Jewelers (local jewelry store, Gujarat)

---

## 1. Purpose & Problem Statement

Avirat Jewelers is a local jewelry store struggling to reach new customers. The store has no online presence, so potential customers who don't already know it by word-of-mouth or walking past never discover it.

**Core goal:** build a website that increases the client's reach to customers.

Everything in this document is scoped against that single goal — discoverability, trust, and low-friction contact are the design priorities, not just feature completeness.

---

## 2. Users & Roles

| Role | Who | What they need |
|---|---|---|
| **Site visitor** | Prospective customer, browsing on desktop or (mostly) mobile | Browse catalog, see products with real detail and trust signals, submit an inquiry — no login required |
| **Admin (client)** | Avirat Jewelers' owner/staff | Fully manage the catalog (products, categories, offers/discounts) and view/manage customer inquiries — with zero code or technical knowledge required |

There is no customer account system and no online payment — this is a lead-generation and showcase site, not e-commerce checkout.

---

## 3. System Overview

Two applications, one shared database:

| App | Domain | Role |
|---|---|---|
| **Public site** | avirat-jewelers.com | Display catalog, capture inquiries. Read-only on catalog data. |
| **Admin dashboard** | admin.avirat-jewelers.com | Sole control plane. Full CRUD on products, categories, offers, discounts. Views/manages inquiries. |

**Backend:** one shared Supabase project (Postgres + Storage + Realtime).
**Admin auth:** Firebase Auth (gates the admin app only; public site has no login).
**Repo structure:** monorepo (Turborepo) — `apps/admin`, `apps/public`, `packages/shared-types`, `packages/supabase-client`.

**Why this matters for reach:** the admin app being a real, form-based control plane means the client can add new stock himself — a stale catalog kills reach as fast as no site at all.

---

## 4. Data Model

### 4.1 `products`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | required |
| `category_id` | uuid FK → categories.id | required, single category per product |
| `description` | text | required |
| `hallmark_certified` | boolean | trust signal, shown publicly |
| `availability` | enum(`available`, `made_to_order`, `sold`) | |
| `price` | numeric | required — base price, shown publicly |
| `offer_id` | uuid FK → offers.id, nullable | at most one offer per product |
| `status` | enum(`draft`, `published`, `archived`) | controls public visibility |
| `image_urls` | text[] | 1–4 images |
| `created_at` / `updated_at` | timestamptz | |

### 4.2 `categories`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | unique, admin-managed (full range of Indian jewelry categories — Rings, Necklaces, Bangles, Mangalsutra, Anklets, Nose Rings, Bracelets, Earrings, Pendants, etc.) |
| `icon_url` | text | |

### 4.3 `offers`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `label` | text | e.g. "Festive Special" — free text |
| `description` | text, nullable | |
| `is_active` | boolean | |
| `start_date` / `end_date` | date, nullable | |

### 4.4 `discounts`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `offer_id` | uuid FK → offers.id | |
| `discount_type` | enum(`percentage`, `flat`) | |
| `value` | numeric | |

### 4.5 `inquiries`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | required |
| `phone` | text | required |
| `email` | text, nullable | |
| `message` | text, nullable | |
| `product_id` | uuid FK → products.id, nullable | set if inquiry came from a product page |
| `status` | enum(`new`, `contacted`, `resolved`) | |
| `created_at` | timestamptz | |

### 4.6 `visits`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `page_path` | text | |
| `product_id` | uuid, nullable | |
| `created_at` | timestamptz | |

### 4.7 Explicitly excluded fields
`making_charges`, `wastage_percent`, `metal_color`, `gender`, `occasion_tags`, `care_instructions`, `video_url` — considered and dropped from products. Do not reintroduce without a fresh client decision.

---

## 5. Access Control (RLS)

| Table | Public (anon) | Admin (service role, server-only) |
|---|---|---|
| `products` | `SELECT` where `status='published'` | full CRUD |
| `categories` | `SELECT` all | full CRUD |
| `offers` | `SELECT` all | full CRUD |
| `discounts` | `SELECT` all | full CRUD |
| `inquiries` | `INSERT` only | `SELECT` / `UPDATE` status |
| `visits` | `INSERT` only | `SELECT` |

Admin's Firebase Auth session is the trust boundary; the Supabase service role key is only ever used server-side in admin API routes, never shipped to any browser bundle.

---

## 6. API Surface

### 6.1 Admin (write)
- `POST /api/admin/products` — create; validates, inserts as `draft`, uploads images, flips to `published` once all images succeed; partial failure keeps `draft` + returns retryable error
- `PATCH /api/admin/products/[id]` — edit any field, partial update; `images` field, if present, **replaces the entire image set** (no incremental add/remove); edits to published products apply live, instantly, no separate publish step
- `DELETE /api/admin/products/[id]` — soft delete → `status: archived` (never hard-deleted, preserves inquiry history)
- `POST /api/admin/categories`, `PATCH /api/admin/categories/[id]` — CRUD
- `POST /api/admin/offers`, `PATCH /api/admin/offers/[id]` — CRUD
- `POST /api/admin/discounts`, `PATCH /api/admin/discounts/[id]` — CRUD
- `GET /api/admin/inquiries`, `PATCH /api/admin/inquiries/[id]` — list/filter, status update

### 6.2 Public (read + inquiry)
- `GET /api/products` — catalog listing; params: `category`, `offer`, price-sort supported (price is public now)
- `GET /api/products/[id]` — full detail incl. category join and resolved offer/discount, used by detail page and by the realtime handler
- `POST /api/inquiries` — public form submission, rate-limited
- `POST /api/visits` — visit tracking beacon

### 6.3 Realtime (public app, client-side, not REST)
Supabase Realtime channel `products-feed`, subscribed to `INSERT`/`UPDATE` on `products` where `status='published'`. On event: fetch full detail via `GET /api/products/[id]`, build a Card component, inject into catalog grid state and BentoGrid "New Arrivals" slice. This is how admin catalog changes appear live on the public site with no redeploy.

---

## 7. Product Status State Machine

```
create (images uploading) → [draft] → all images uploaded → [published]
[draft] → image upload fails → stays [draft], admin retries
[published] → admin archives → [archived] → admin un-archives → [published]
```
Edits to published products apply instantly — no manual "publish" gate on edits, only on initial creation (automatic, not admin-triggered).

---

## 8. Public Site — Features & UX

### 8.1 Header
- Auto-hide header
- Logo placeholder (30×30) + "Avirat Jewelers" wordmark, build-up entrance animation (20px bound), banner descent on load
- Nav: Home, About Us, Store, Contact Us — bold on hover; Home builds a home icon, Store builds a cart icon + category dropdown, Contact Us builds a contact icon, all on hover

### 8.2 Homepage — BentoGrid
- Fills the entire viewport on load, only content besides header
- Tiles: Products / Products with Offers / Custom Jewelry (→ Contact Us)
- New product publishes surface here live via realtime as "New Arrivals"
- Tile click routes to **Our Collection** page

### 8.3 Our Collection page
- Offer/special cards at top
- Category cards below (icon + name), routes into filtered catalog
- Filter pills: All, Rings, Necklaces, Bracelets, Earrings, Pendants, etc.
- Swiper for long category lists

### 8.4 Catalog & product detail
- Grid of cards, sized to predefined slots
- Card shows: image, name, price, discounted price + offer badge if applicable
- Detail page: 1–4 images, full description, hallmark certification, availability, price, offer/discount if active
- Sort by discount/price high-to-low supported on collection/category pages

### 8.5 Inquiry capture
- Contact/booking form, `POST /api/inquiries`
- Reachable from product detail (pre-fills `product_id`) or general Contact Us page

---

## 9. Admin Dashboard — Features & UX

### 9.1 Shell
- Firebase Auth login
- Sidebar: Overview / Inquiries / Products / Categories / Offers / Analytics

### 9.2 Overview
- Inquiry count (realtime), recent inquiries widget, quick-add links

### 9.3 Products
- List/table, search + category filter
- Add Product form: name, category, description, hallmark toggle, availability, price, offer selection (from existing offers), multi-image upload (1–4)
- Edit form: same fields, pre-filled; image edits replace the full image set
- Archive action

### 9.4 Categories
- List + Add/Edit form (name, icon upload) — fully admin-manageable, no code changes needed for new categories

### 9.5 Offers & Discounts
- Offers list: label, description, active toggle, start/end date
- Add/Edit offer form
- Discounts tied to an offer: type (percentage/flat) + value
- Products reference an offer via dropdown in the product form

### 9.6 Inquiries
- Table: name, phone, email, message, linked product, status
- Status update action

### 9.7 Analytics
- Basic visit counts, popular products (lower priority)

---

## 10. Visual Design

| Token | Value |
|---|---|
| Base | White / off-white |
| Secondary | Dusty rose pink `#C98A96` |
| Accent | Warm charcoal-grey `#6B6560` |
| Gold accent | Muted brass/champagne `#C9A66B` |
| Headings | Serif |
| Body | Grotesque sans |
| Motif | Thin gold "chain link" hairline in product carousel |

Logo not yet received — placeholder box in use until supplied.

---

## 11. Non-Goals (explicitly out of scope)

- No online payment / checkout
- No customer accounts or login on the public site
- No multi-category products (one category per product)
- No hard deletes of products (soft delete/archive only, to preserve inquiry history)
- No price fields beyond `products.price` (no per-variant pricing, no making charges/wastage breakdown)

---

## 12. Build Order

1. **Foundation** — monorepo, schema migrations, RLS, storage buckets, shared types
2. **Admin: Auth + Shell**
3. **Admin: Products CRUD**
4. **Admin: Categories CRUD**
5. **Admin: Offers & Discounts CRUD**
6. **Admin: Inquiries + Overview**
7. **Public: Read API + Realtime wiring**
8. **Public: Header, Homepage BentoGrid, Our Collection, Catalog, Product Detail**
9. **Public: Inquiry capture + visit tracking**
10. **Admin: Analytics** (lower priority)

Admin is built first since it's the control plane the public site depends on for content.

---

## 13. Open Questions

1. Manual "Publish" step for new products, or keep automatic-on-upload-complete?
2. Inquiry spam protection approach — rate limit, CAPTCHA, or honeypot?
3. Server-side image resizing/optimization before storage, or store as-is?
4. Does `offers.start_date`/`end_date` auto-expire the offer, or is `is_active` always manual?

---

## 14. Success Criteria

Tied back to the core goal (increase reach):
- Client can independently add/edit/archive products and offers without developer involvement
- New products appear live on the public site within seconds of publishing (no redeploy)
- Inquiry form is functional, low-friction, and inquiries are visible/actionable in admin
- Site is mobile-first performant, since most local discovery traffic will be mobile
- Basic visit tracking gives the client visibility into whether reach is actually growing
