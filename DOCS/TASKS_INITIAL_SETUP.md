# TASKS_INITIAL_SETUP.md — Avirat Jewelers

Scope: this file covers **only** initial repo/environment setup (PRD §12 Phase 1 — Foundation). No product, category, offer, or UI feature work belongs here — see the main PRD for those. Every task completed from this file must also get an entry in `AGENT_LOG.md` per its logging rules.

Check off tasks in order; most have a hard dependency on the one above it.

---

## 1. Repo scaffolding
- [ ] Initialize monorepo root with Turborepo (`npx create-turbo@latest`)
- [ ] Create `apps/admin` — new Next.js app (App Router, TypeScript)
- [ ] Create `apps/public` — new Next.js app (App Router, TypeScript)
- [ ] Create `packages/shared-types` — empty TS package, wired into workspace
- [ ] Create `packages/supabase-client` — empty TS package, wired into workspace
- [ ] Confirm both apps can import from both packages (workspace resolution works) with a throwaway test import
- [ ] Add root `.gitignore` (node_modules, .env*, .next, .turbo)
- [ ] Add `AGENT_LOG.md` and this file to repo root
- [ ] Initial commit

## 2. Environment & secrets
- [ ] Create Supabase project
- [ ] Record project URL + anon key (safe for public app) and service role key (admin-only, server-side)
- [ ] Create `.env.local` in `apps/public` — anon key only
- [ ] Create `.env.local` in `apps/admin` — service role key + Firebase config
- [ ] Confirm `.env*` is gitignored in both apps (do not commit any key)
- [ ] Create Firebase project, enable Auth (method TBD — confirm with client: email/password vs. Google sign-in)
- [ ] Record Firebase config values into `apps/admin/.env.local`

## 3. Row Level Security
- [ ] Enable RLS on all tables once they exist (RLS is opt-in per table in Supabase — do not skip any)
- [ ] Write + apply public-read policy on `products` (status='published' only)
- [ ] Write + apply public-read policy on `categories`, `offers`, `discounts`
- [ ] Write + apply insert-only policy on `inquiries` for anon role
- [ ] Write + apply insert-only policy on `visits` for anon role
- [ ] Confirm service role key bypasses RLS as expected (used only in admin server routes)
- [ ] Manually test: attempt a write to `products` using the anon key and confirm it is rejected

## 4. Storage
- [ ] Create Supabase Storage bucket `product-images`
- [ ] Create Supabase Storage bucket `category-icons`
- [ ] Set bucket access policy: public read, write restricted to service role only
- [ ] Test upload + public URL retrieval for one throwaway image in each bucket, then delete the test files

## 5. Shared packages
- [ ] Define TypeScript types in `packages/shared-types` for: `Product`, `Category`, `Offer`, `Discount`, `Inquiry`, `Visit`
- [ ] Build typed Supabase client factory in `packages/supabase-client` — one variant for anon-key (public app) usage, one for service-role (admin app) usage
- [ ] Import and use both shared packages from a placeholder page in each app to confirm wiring works end-to-end

## 6. Verification checklist (setup is "done" when all true)
- [ ] Both apps run locally (`turbo dev` or per-app `next dev`) without errors
- [ ] Public app can read from `categories` table using the anon key
- [ ] Admin app can read/write to `products` table using the service role key from a server route
- [ ] RLS confirmed blocking public writes (from §3 test)
- [ ] No secret values appear in any committed file
- [ ] `AGENT_LOG.md` has a complete entry (100+ words) summarizing the setup work performed

---

## Explicitly out of scope for this file
Database schema/migrations, admin UI/forms, public UI/pages, product CRUD logic, realtime subscription wiring, inquiry form, Firebase login page implementation — all belong to later phases in the PRD (§12, Phases 2 onward).
