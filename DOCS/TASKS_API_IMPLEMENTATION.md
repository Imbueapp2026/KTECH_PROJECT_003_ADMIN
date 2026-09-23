# TASKS_API_IMPLEMENTATION.md
Avirat Jewelers — API & System Design Implementation
Status: DRAFT for Cascade
Source spec: `04-API.md` (uploaded reference document — read that first, this file breaks it into
buildable tasks and adds two additions: test scripts per API, and a minimal public catalog page)

---

## Part 1 — Explain the design to the agent

Read this section before writing any code. It's the reasoning behind the spec, not just a list
of endpoints.

**Core principle:** Admin is the sole write authority for catalog data. Public is read-only on
catalog, insert-only on inquiries/visits. Supabase Realtime is the *only* notification mechanism
between admin writes and public updates — there is no webhook, no polling API, no separate
"notify" step. When admin writes a row, Realtime pushes the change; public subscribes and reacts.

**Trust boundary:** Admin's own login (Firebase Auth) is the trust boundary — not Supabase RLS
per-identity. Admin server routes hold the Supabase **service role key** (full access, bypasses
RLS) and that key never reaches any browser bundle. Public browser code only ever gets the
**anon key**, which RLS restricts to published-only reads and insert-only writes. This is why the
Auth Check API (from TASKS_BACKEND_API.md) matters so much: it's the *entire* gate standing
between "anyone on the internet" and "full database access," since Supabase itself doesn't know
who the admin user is.

**Status is a state machine, not a toggle.** Products move `draft → published → archived`.
`draft → published` is automatic once all images finish uploading — not a manual "Publish"
button (flagged as an open design question in the source doc, currently built as automatic).
`published → archived` is a soft delete triggered by the admin Delete action, so inquiry history
referencing a product is never orphaned by a hard delete.

**Realtime is client-side subscription, not a REST endpoint.** The public app subscribes to
`postgres_changes` on the `products` table filtered to `status=eq.published`, and on
INSERT/UPDATE calls `GET /api/products/[id]` to hydrate the full row before building a card and
injecting it into the catalog grid / BentoGrid "New Arrivals" slice. This two-step
(event-notifies → REST-hydrates) pattern exists because Realtime payloads are partial/raw rows,
not the joined, presentation-ready shape the UI needs.

**⚠️ Reconcile before building — this source doc conflicts with decisions made since:**
1. **Pricing:** §8 of this doc says "no price data anywhere in schema" as a confirmed decision.
   That has since been reversed — the live schema now includes `price` on `products` and a
   proper `offers`/`discounts` table pair (not the `is_offer`/`offer_label` boolean+text fields
   this doc describes). **Do not build against the `is_offer`/`offer_label` fields in this doc —
   use the actual live schema** (already migrated, per AGENT_LOG.md) as source of truth for field
   names; treat this doc's data model section (§2) as superseded, its API surface/task-breakdown
   structure as still valid.
2. **Inquiry status enum:** this doc specifies `new → contacted → resolved`. The admin UI spec
   (TASKS_ADMIN_DASHBOARD.md) was written against `new → open → closed`. **Pick one before
   building the Inquiries API** — recommend keeping whatever the live migrated schema already
   uses, and updating the other document to match rather than building two different enums.
3. **Sidebar tabs:** this doc's Phase B lists a 5-tab shell (Overview / Inquiries / Products /
   Categories / Analytics). The confirmed admin UI spec is 4 tabs (Products, Inquiry, Categories,
   Offers and Discount) with no Overview/Analytics tab yet. **Build the 4-tab version** — this
   doc's task breakdown for Phase B should be read as superseded by TASKS_ADMIN_DASHBOARD.md for
   the shell itself, while its *API* tasks (auth guard on `/api/admin/*`) still apply as-is.

Flag all three reconciliations in AGENT_LOG.md as you hit them, don't silently pick one — a
one-line note ("built against live schema's `price`/`offers` tables, not this doc's `is_offer`
field, per reconciliation note in TASKS_API_IMPLEMENTATION.md") is enough.

---

## Part 2 — Tasks

### A. Admin write endpoints
1. `POST /api/admin/products` — validate payload, insert as `draft`, upload images to
   `product-images/{product_id}/`, flip to `published` once all images confirm, partial-failure
   response (leave `draft`, return errors) if any image upload fails.
2. `PATCH /api/admin/products/[id]` — partial update, does not change `status` implicitly.
3. `DELETE /api/admin/products/[id]` — soft delete (`status: archived`), never hard-delete.
4. `POST /api/admin/categories`, `PATCH /api/admin/categories/[id]` — same pattern, simpler
   payload (name + icon upload).
5. `GET /api/admin/inquiries`, `PATCH /api/admin/inquiries/[id]` — list/filter, status update
   (use the reconciled enum per Part 1, item 2).
6. All of the above sit behind the Auth Check API (and Role-Based Security API where relevant,
   e.g. delete actions) from TASKS_BACKEND_API.md — do not build these routes before that
   middleware exists, or they'll need retrofitting.

### B. Public read + write endpoints
1. `GET /api/products` — catalog listing, query params `category`, `sort`, `offer=true`
   (re-evaluate `sort` options now that `price` exists in the live schema — this doc excluded
   price-based sort because price didn't exist yet; it does now).
2. `GET /api/products/[id]` — full detail incl. joined category; used by both the detail page
   and the realtime hydration handler.
3. `POST /api/inquiries` — public form submission, no auth, rate-limited (per TASKS_BACKEND_API.md
   §3).
4. `POST /api/visits` — fire-and-forget visit beacon.

### C. Realtime wiring
1. Build the subscription exactly as in the source doc §4.3, but also subscribe to `offers` and
   `discounts` table changes (not in the original doc, needed now that pricing/discounts exist)
   so a discount edit on the admin Offers page triggers a live price update on public product
   cards — this was already flagged as a requirement in TASKS_BACKEND_API.md §4.
2. Reuse the shared realtime helper from `packages/supabase-client` (built in
   TASKS_BACKEND_API.md §4) rather than writing a second, separate subscription implementation
   here.

### D. NEW — Test scripts (write alongside every API, not after)
For **each** endpoint built in sections A and B, write a test script before considering that
endpoint done — not as a separate later pass. Minimum coverage per endpoint:
1. **Happy path** — valid request produces the expected row/response.
2. **Validation failure** — missing required field, malformed payload → correct error response,
   no partial/corrupt write.
3. **Auth/RLS boundary** — for admin routes: request without a valid Firebase token is rejected;
   for public routes: attempt to read/write something outside the allowed shape (e.g. inserting
   into `products` via the public insert path) is rejected by RLS, not just by app-layer code.
4. **State-machine edge case** where relevant — e.g. product creation with a failed image upload
   stays in `draft`, not `published`; archived product no longer appears in `GET /api/products`.
Place these under a `tests/` (or `__tests__/`) directory colocated with each app/package,
following whatever test runner is already configured in the monorepo (check `package.json` before
introducing a new one). Log which runner/pattern was used in AGENT_LOG.md the first time, so
later phases follow the same convention rather than each picking a different tool.

### E. NEW — Minimal public catalog page (build now, ahead of the full public site)
Before the full public site (Catalog Grid, BentoGrid, DRD-styled homepage) is built, create a
**bare, unstyled placeholder page** to validate the write→realtime→read pipeline end-to-end:
1. A single page, plain black background, no styling beyond that — this is a functional smoke
   test page, not a designed page, and should be named/routed so it's obviously temporary (e.g.
   `/dev-preview` or similar — Cascade's call, but do not build this at the real homepage route).
2. A simple card component: product image (or placeholder if none), name, price. No grid
   discipline, no DRD styling, no animation — the only job of this page is to prove that when an
   admin adds a product, it appears here live via the realtime subscription without a refresh.
3. Once sections A–C above are functioning and this page visibly proves the pipeline works, this
   page can be deleted/replaced by the real DRD-styled public catalog — flag that as a follow-up
   task rather than polishing this placeholder further.

---

## Part 3 — Build order

1. Reconcile the three conflicts in Part 1 (schema/enum/sidebar) — quick decisions, but block
   correct API-shape work if skipped.
2. Admin write endpoints (A) — behind Auth Check + Role-Based Security from TASKS_BACKEND_API.md.
3. Public read/write endpoints (B).
4. Realtime wiring (C).
5. Test scripts (D) — written per-endpoint alongside A/B, not deferred to the end.
6. Minimal public preview page (E) — as soon as A + C are functional enough to demo the pipeline,
   even before B/D are fully complete, since seeing it work live is valuable early feedback.

Log progress and any reconciliation decisions to AGENT_LOG.md per the existing convention.
