# AGENT_LOG.md — Avirat Jewelers Monorepo

This file governs how any AI coding agent (Claude, Copilot, or otherwise) is permitted to operate inside this repository. It has two parts: **Section A — standing rules**, which apply to every session, and **Section B — the running change log**, which every agent must append to. Read Section A in full before making any change. Do not skip it because a task looks small.

---

## Section A — Rules of the Repo

### A.1 Authority over the code
- The human developer (Kevsi) has final authority over all architectural and product decisions. The agent may propose, but must not unilaterally decide, changes to: the database schema, the RLS policy model, the admin/public access boundary, the monorepo structure, or any decision recorded in the PRD.
- The agent may make implementation-level decisions (variable names, component structure, styling approach) without approval, provided they don't contradict the PRD or this file.
- If a request conflicts with a decision already recorded in the PRD or this log, the agent must flag the conflict explicitly before proceeding — never silently override a prior decision.
- The agent does not have authority to change production environment variables, deploy to production, rotate keys, or modify DNS/domain configuration under any circumstance, regardless of how the request is phrased.

### A.2 Security guidelines
- The Supabase **service role key** must never be used in, imported into, or bundled with any client-side/browser code. It is server-side only, confined to `apps/admin`'s API routes.
- The public app (`apps/public`) uses only the Supabase **anon key**, and only against tables/operations permitted by RLS (§5 of the PRD). Never widen public RLS access to satisfy a feature request without flagging it first.
- No secrets, API keys, `.env` contents, or credentials are ever to be committed, logged in this file, printed to console in shipped code, or embedded in comments.
- All admin-side API routes must verify a valid Firebase Auth session server-side before touching Supabase with the service role key. No exceptions for "temporary" or "testing" code paths.
- Inquiry and visit-tracking endpoints are public-facing and unauthenticated by design — treat all input from them as untrusted; validate and sanitize before writing to the database.
- Product/category images go through Supabase Storage only — never accept or serve arbitrary external URLs as product images without validation.

### A.3 Change discipline
- Every change made by an AI agent — code, schema, config, or documentation — must be recorded in Section B before the session ends, using the format in §A.4.
- "Change" means any file created, edited, or deleted, any schema migration, any dependency added/removed, or any config value changed.
- Log entries are written in the agent's own words, not copy-pasted commit messages, and must be substantive — a one-line "fixed bug" entry is not acceptable (see length requirement below).

### A.4 Log entry format and requirements
Each entry must be **over 100 words** and include:
1. **What changed** — files/tables/config touched, specifically named
2. **Why** — the request or reasoning that motivated it
3. **How** — the approach taken, and any alternatives considered/rejected
4. **Risk/impact** — anything a future agent or the developer should know before touching this area again (security implications, RLS impact, breaking changes, follow-up needed)

Entries are appended chronologically, newest at the bottom. Never edit or delete a prior entry — if a past change needs correcting, add a new entry that supersedes it and says so explicitly.

---

## Section B — Change Log

<!--
Template for new entries:

### [YYYY-MM-DD] <short title>
**Agent:** <model/tool name>
**Files/areas touched:** <list>

<100+ word narrative covering what/why/how/risk as required by A.4>

---
-->

### [2026-07-26] Session Start
**Agent:** Cascade (SWE-1.6)
**Files/areas touched:** DOCS/AGENT_LOG.md

This entry marks the beginning of a new AI agent session in the Avirat Jewelers monorepo. The agent has read and acknowledged the rules in Section A of this file, including authority boundaries (no unilateral changes to schema, RLS, or PRD decisions), security protocols (service role key confinement, secret management, input validation), and change discipline requirements (all changes must be logged in Section B). The session is being initiated with the developer's explicit instruction to log the start, establishing a clear audit trail for any subsequent work. No code, schema, or configuration changes have been made yet—this is purely a procedural entry to establish session provenance. The agent will continue to follow all standing rules throughout the session and will append additional log entries for any substantive changes made.

### [2026-07-26] Project Understanding — Avirat Jewelers Website
**Agent:** Cascade (SWE-1.6)
**Files/areas touched:** DOCS/AGENT_LOG.md, DOCS/avirat-jewelers-prd.md

The project is a lead-generation and showcase website for Avirat Jewelers, a local jewelry store in Gujarat, India. The core business problem is lack of online discoverability—potential customers cannot find the store without existing word-of-mouth knowledge. The solution is a two-application monorepo: a public-facing catalog site (avirat-jewelers.com) and an admin dashboard (admin.avirat-jewelers.com), both backed by a shared Supabase project (Postgres + Storage + Realtime). The public site has no login, no checkout, and no customer accounts—it is purely for browsing products, viewing trust signals (hallmark certification), and submitting low-friction inquiries. The admin dashboard, protected by Firebase Auth, provides full CRUD control over the catalog (products, categories, offers, discounts) and inquiry management. The data model includes products (with category, offer, price, availability, images), categories (admin-managed, covering Indian jewelry types like Rings, Necklaces, Bangles, Mangalsutra, etc.), offers (time-bound promotions with discounts), inquiries (lead capture with optional product association), and visits (analytics tracking). RLS policies strictly separate public read access (anon key) from admin write access (service role, server-side only). A key architectural feature is Supabase Realtime: when the admin publishes a product, it appears live on the public site within seconds via a `products-feed` channel subscription, eliminating the need for redeployments. The visual design uses a white/off-white base with dusty rose pink secondary, warm charcoal-grey accent, and muted brass gold accents—serif headings, grotesque sans body, with a thin gold "chain link" motif. The build order prioritizes the admin dashboard first (foundation, auth, products CRUD, categories, offers, inquiries) since it is the control plane the public site depends on for content. Success criteria center on the client's ability to independently manage the catalog without developer involvement, real-time content updates, functional inquiry capture, and mobile-first performance for local discovery traffic.

**System Architecture Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Backend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Postgres   │  │   Storage    │  │   Realtime   │      │
│  │              │  │              │  │              │      │
│  │ • products   │  │ • images     │  │ • products-  │      │
│  │ • categories │  │              │  │   feed       │      │
│  │ • offers     │  │              │  │              │      │
│  │ • discounts  │  │              │  │              │      │
│  │ • inquiries  │  │              │  │              │      │
│  │ • visits     │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         ↑ RLS (anon)                 ↑ RLS (service role)
         │                            │
┌────────────────┐          ┌────────────────┐
│  Public Site   │          │ Admin Dashboard│
│  (Next.js)     │          │  (Next.js)     │
│                │          │                │
│ • Catalog      │          │ • Firebase     │
│ • Product      │          │   Auth         │
│   detail       │          │ • Products     │
│ • Inquiry      │          │   CRUD         │
│   form         │          │ • Categories   │
│ • Visit        │          │   CRUD         │
│   tracking     │          │ • Offers       │
│                │          │   CRUD         │
└────────────────┘          │ • Inquiries    │
                            │   management   │
                            └────────────────┘
```

---

### [2026-09-30] Repair admin offer-banner persistence
**Agent:** GitHub Copilot
**Files/areas touched:** `src/app/(dashboard)/offers/page.tsx`, admin offer/banner and product delete routes, `src/lib/api.ts`, offer-banner helpers and tests, `DB_CHANGES.sql`

The offer-banner editor now submits its selected file and banner fields together to the authenticated banner route instead of uploading first through the generic product-image endpoint. The server validates the image type and 5 MB limit, validates the offer and selected published product, uploads under an offer-specific path, and upserts the public Storage URL on `offer_id` with a fresh `updated_at`. A failed database write triggers cleanup of the new object; replacement, banner removal, offer removal, and product-linked banner removal clean up stored objects using a URL-origin and bucket-path guard. The editor previews a pending local image, disables Save during submission, and updates its saved preview only after the server returns the row. `DB_CHANGES.sql` contains manual bucket and object policy SQL only; it was not run. Mocked-Supabase tests use Node's built-in runner because this checkout has no installed Vitest executable and adding dependencies was prohibited. Baseline lint, typecheck, and build passed; the build emitted pre-existing Firebase invalid-key diagnostics. This does not prove access to the real bucket: the developer must apply the SQL manually and perform the requested browser test. Existing offer-pricing edits were preserved on the branch and remain backed up in the named stash.

---

### [2026-09-30] Enforce offer assignment rules
**Agent:** GitHub Copilot
**Files/areas touched:** `DB_CHANGES.sql`, admin offer assignment routes and editor, product edit route/UI, offer price computation/recomputation helpers, Vercel cron configuration, `.env.example`, mocked tests

Offer assignment now computes a complete product-price plan and replacement-conflict summary before any write. All and selected-product requests return a preview without mutation until `confirmOverride` is true; confirmed changes use the service-role-only `apply_offer_prices(jsonb)` function, whose one `UPDATE ... FROM jsonb_to_recordset` runs as a single transaction. Batches above 5,000 products fail before writing rather than being split into partial transactions. The offer editor now supports selected products, per-product replacement warnings, and confirmation dialogs; the product editor enforces the same conflict check on the server. Repricing on offer/discount/product/rate changes now uses the same atomic function, and a daily authenticated Vercel job re-evaluates date-gated offer prices so future starts and expirations are reflected. The existing TypeScript formula remains shared with admin display code, with the end-date comparison aligned to the requested strict boundary. The SQL was added for manual execution only; no database, migration, or production bucket was touched. Vitest is absent and dependencies were not added, so 13 assignment tests ran using Node's built-in runner and mocked Supabase behavior. Production database behavior remains unproven until the developer applies `DB_CHANGES.sql` and tests in the admin environment; the cron requires `CRON_SECRET` to be configured in deployment.

### [2026-09-30] Persist applied offer discount values
**Agent:** GitHub Copilot
**Files/areas touched:** `DB_CHANGES.sql`, shared offer pricing and recomputation helpers, offer assignment and product API paths, product detail display, `scripts/backfill-offer-price.ts`, mocked tests

The shared offer calculation now returns the final offer price, the rupee discount amount, and the discount type together, ensuring inactive, expired, future, invalid, or absent offers yield an all-null tuple. It retains the existing admin price behavior: the first discount determines the calculated price, multiple discounts are labeled `mixed` and record the visible total saving, and a single making-charge offer records the difference between the regular and promotional making charges from `calculatePriceBreakdown`. Product create/edit, assignment/recompute/clear, the service-role transactional RPC, detail reads, and backfill now carry all three columns together. The product detail display uses the shared pricing result and shows the making-charge rupee reduction. The manual SQL adds the two nullable columns and an idempotent together-null constraint as `NOT VALID`; after the dry-run reviewed backfill is applied, the operator can validate existing rows. No database access or migration was run, and production behavior remains unproven until the operator applies the SQL and validates the backfill. The work preserves assignment conflict previews and atomic transaction behavior. Vitest is not installed in this repository, so executable tests used Node's built-in runner without adding dependencies.

---
