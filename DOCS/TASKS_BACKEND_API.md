# TASKS_BACKEND_API.md
Avirat Jewelers — Backend API Layer (Auth, Security, Rate Limiting, Realtime, Health, Intrusion Detection)
Status: DRAFT for Cascade

This doc has two parts for each API: **Role** (why it exists, what it protects, how it fits the
existing architecture) and **Tasks** (what to actually build). Read the Role section fully before
starting the Tasks — these APIs sit underneath every admin page already speced in
TASKS_ADMIN_DASHBOARD.md, so getting the contracts right here avoids rework there.

Reference: existing architecture is Next.js monorepo (`apps/admin`, `apps/public`), Firebase Auth
for admin identity, Supabase (Postgres + Realtime + Storage) as the shared data layer. `packages/
shared-types` and `packages/supabase-client` are the shared packages — new API logic that's
reused across admin and public routes belongs there, not duplicated per-app.

---

## 1. Auth Check API

### Role
Every request to `/api/admin/*` must prove the caller is an authenticated admin before touching
Supabase. This is the gate mentioned in the original next-phase plan ("server-side auth guard").
Firebase issues the ID token on login; this API's job is to **verify that token server-side on
every admin request** — never trust a client-side "I'm logged in" flag alone, since that can be
spoofed. Public-facing routes (product reads, inquiry/visit inserts) do NOT go through this
check — they use the Supabase anon key with RLS enforcing read-only/insert-only access, per the
existing access model.

### Tasks
1. Build a shared `verifyAdminAuth` middleware/helper (in `packages/supabase-client` or a new
   `packages/auth` package — Cascade's call, but keep it importable by every `/api/admin/*` route
   rather than copy-pasted per-route).
2. Helper accepts the incoming request, extracts the Firebase ID token (Authorization header,
   `Bearer <token>`), verifies it against Firebase Admin SDK, and returns the decoded user or
   throws/returns a 401.
3. Wire this into every existing and future `/api/admin/*` route as the first check — no route
   handler body executes before this passes.
4. Log auth failures (401s) — not full request bodies, just timestamp, route, and reason
   (missing token / invalid token / expired token) — this feeds the intrusion detection script
   in §6.

---

## 2. Role-Based Security API

### Role
Not every authenticated admin necessarily has the same permissions long-term (e.g. a future
"staff" role that can view but not delete, vs. an "owner" role with full CRUD) — even if today
every admin account is full-access, building the role check as a first-class layer now avoids a
painful retrofit later. This sits **on top of** the Auth Check API: Auth Check answers "who is
this," Role-Based Security answers "what are they allowed to do."

### Tasks
1. Add a `role` field to the admin user record (Firebase custom claims, or a Supabase `admin_users`
   table keyed by Firebase UID — Cascade's call on which is simpler given the current setup).
2. Define roles for now: `owner` (full CRUD everywhere) and `staff` (read + edit, no delete) —
   even if every current account is `owner`, the enum should exist so it's not a schema change
   later.
3. Build a `requireRole(minRole)` helper that wraps `verifyAdminAuth` — routes declare the
   minimum role they need (e.g. delete-product route requires `owner`).
4. Apply it to at least the delete operations across Products/Categories/Offers as the first
   real usage, since deletion is the highest-risk action.

---

## 3. Rate Limiter

### Role
Protects both the admin API (against brute-force login attempts, scripted abuse of an admin
session) and the public-facing insert endpoints (`inquiries`, `visits`) — since those are
insert-only with the anon key, they're the most exposed surface to spam or abuse (e.g. someone
scripting thousands of fake inquiries).

### Tasks
1. Add rate limiting to `/api/admin/login` (or wherever Firebase login is proxied through the
   app, if at all — if login goes directly client-to-Firebase, rate-limit the forgot-password
   and any other admin-initiated API endpoints instead) — limit by IP + email combination to
   avoid one bad actor locking out a real user's IP.
2. Add rate limiting to the public inquiry-submission and visit-logging endpoints — by IP,
   generous enough not to block real visitors browsing multiple products (visits) but tight
   enough to stop scripted inquiry spam.
3. Implementation: Cascade's call on mechanism (in-memory for a single-instance deploy vs. a
   Supabase-backed or Redis-backed counter if the app runs on multiple instances/serverless
   functions where in-memory state won't persist across requests) — flag which was chosen and
   why in AGENT_LOG.md, since this affects reliability under real traffic.
4. Rate-limited requests return a clear, plain-language response (not a raw 429 with no body) —
   per the writing principles already established for the UI: state what happened and what to
   do (e.g. "Too many attempts — try again in a few minutes").

---

## 4. Realtime API (fetch + post to database in realtime)

### Role
This is the mechanism behind the "admin edits → public site updates live" workflow already
specified in the PRD and Products task. It has two directions:
- **Fetch (subscribe):** both admin and public apps need to subscribe to Supabase Realtime
  channels for the relevant tables (`products`, `categories`, `offers`, `discounts` on the
  public side; all of those plus `inquiries` on the admin side) so UI updates without a manual
  refresh.
- **Post (write):** admin write operations (create/update/delete product, resolve inquiry, etc.)
  go through the normal Supabase client with RLS enforcing the access model — Realtime picks up
  the resulting change and pushes it out. This API doesn't need a separate "post" mechanism
  beyond the existing Supabase writes; the "realtime" part is entirely the subscribe side.

### Tasks
1. Build a shared realtime subscription helper in `packages/supabase-client` — e.g. a
   `useRealtimeTable(tableName, filters)` hook (or equivalent for server components) that both
   apps can reuse rather than each app writing its own Supabase Realtime channel logic.
2. Public site: subscribe product cards / catalog grid to `products` **and** the joined
   `offers`/`discounts` tables (flagged previously — a discount edit must trigger a live price
   update on public product cards, not just direct product-field edits).
3. Admin: subscribe the Products list/detail, Categories (for live product counts), and
   Inquiry list to their respective tables so concurrent admin sessions and new public-visitor
   inquiries appear without refresh, per TASKS_ADMIN_DASHBOARD.md.
4. Handle reconnection/cleanup correctly — unsubscribe on component unmount, and consider what
   happens if a Realtime connection drops (silent stale data is worse than a visible
   "reconnecting" indicator on admin screens where accuracy matters).

---

## 5. Health Check API

### Role
A simple endpoint to confirm the app and its dependencies (Supabase connection, Firebase Auth
reachability) are up — useful for monitoring/uptime checks and for quickly diagnosing "is it the
app or is it Supabase" during any future incident.

### Tasks
1. Build `/api/health` (public, no auth required) that checks: app itself responds, Supabase
   connection succeeds (a trivial read), and returns a simple JSON status (`{ status: "ok",
   checks: { supabase: "ok", ... } }` or similarly, with a non-200 status if any check fails.
2. Do not expose sensitive details in the response (no connection strings, no stack traces) —
   status booleans/strings only.
3. This can reuse the "connection checker" already built and verified in the foundation phase —
   check AGENT_LOG.md for what that already does before building a duplicate.

---

## 6. Intrusion Detection Script

### Role
A lightweight script/job that watches for signs of abuse across the logs the above APIs already
produce (auth failures from §1, rate-limit triggers from §3) — this is not a full security
product, just a first pass at catching obvious patterns (repeated failed logins from one
IP, rate-limit floods) and surfacing them, since the site is currently a small business
deployment without a dedicated security team watching it.

### Tasks
1. Define what "suspicious" means concretely for a v1: e.g. more than N failed admin-login
   attempts from one IP in a short window, or an IP repeatedly hitting rate limits on the public
   insert endpoints.
2. Decide where these logs live — Cascade's call given the deploy target (a hosted logging
   service, a Supabase table written to from §1/§3's logging calls, etc.) and keep the schema
   simple: timestamp, IP, route, reason.
3. Script (can be a scheduled function, or a simple on-write check that flags a row) reviews
   recent entries and produces a flag/alert — for v1, an entry in a `security_flags` table (or
   equivalent) is enough; a real alerting channel (email/Slack) can come later once this is
   proven out.
4. This is explicitly v1/lightweight — do not over-build; log a clear note in AGENT_LOG.md on
   what was intentionally left out (e.g. no IP-blocking automation yet, just flagging) so it's
   not mistaken for a finished security system.

---

## 7. Build order (proposed)

1. Auth Check API (blocks everything else needing admin routes)
2. Role-Based Security API (thin layer on top of #1)
3. Rate Limiter (independent, can run in parallel with #1/#2)
4. Realtime API (depends on #1 for admin-side subscriptions being behind auth)
5. Health Check API (independent, quick win)
6. Intrusion Detection Script (depends on logging already emitted by #1 and #3 — build last)

Log each to AGENT_LOG.md as usual, including any implementation choice left open above
(role storage mechanism, rate-limiter backing store, log storage location).
