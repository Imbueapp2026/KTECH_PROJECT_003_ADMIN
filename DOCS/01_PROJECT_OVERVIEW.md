# 01_PROJECT_OVERVIEW.md — Avirat Jewelers

Read this first, before touching any code. This file exists so any AI agent (or new human developer) can understand *what* this project is and *why* it's built the way it is, without re-deriving decisions that have already been made.

---

## What we're building

A two-application website for **Avirat Jewelers**, a local jewelry store in Gujarat, India.

**The client's stated goal:** increase his reach to customers. He currently relies on foot traffic and word-of-mouth; the site's entire job is to get his catalog in front of people who'd never otherwise find the store.

**What this is not:** an e-commerce checkout system. There is no online payment. The site shows the catalog and captures leads (inquiries) — the actual sale still happens in person or over phone/WhatsApp after someone inquires.

## The two applications

| App | Audience | Role |
|---|---|---|
| **Public site** | Prospective customers, mostly on mobile | Browse the catalog, see trust signals (hallmark certification, purity), see current offers/discounts, submit an inquiry. No login. |
| **Admin dashboard** | The client himself, non-technical | Add, edit, and archive products, categories, offers and discounts — entirely through forms, no code. View and manage incoming inquiries. |

**The admin dashboard is the control plane.** Every piece of catalog content that appears on the public site originated from an admin action. The client must be able to add a new product himself, without calling a developer, or the whole "increase reach" goal fails the moment the catalog goes stale.

## Why the architecture looks the way it does

- **One shared Supabase backend, two separate frontends (monorepo).** Both apps read/write the same Postgres database, so there is one source of truth for products, categories, offers, and inquiries. The monorepo (not two separate repos) exists so shared types and the Supabase client setup aren't duplicated between the two apps.
- **Admin writes, public only reads (plus captures inquiries).** This is a hard boundary, enforced by Supabase Row Level Security, not just convention. The public site's Supabase key can only read published catalog data and insert into `inquiries`/`visits` — nothing else. This means even if the public site's code had a bug, it structurally cannot corrupt the catalog.
- **Supabase Realtime, not a custom notification API.** When the admin publishes a new product, the public site picks it up live via a Realtime subscription — no redeploy, no polling, no custom webhook. Supabase's built-in change-feed *is* the "tell the public site something changed" mechanism.
- **Firebase Auth gates the admin app only.** The public site has no login at all. Admin's trust boundary is its own Firebase session check on the server — Supabase doesn't need to know about Firebase identities, because the admin app's API routes are the only thing holding the powerful service-role Supabase key, and that key never reaches any browser.

## Key decisions and reversals worth knowing about

Decisions in this project changed shape more than once during planning — if you're picking this up fresh, these are the *current, final* answers, not the first draft:

- **Price and discounts ARE shown on the public site.** An earlier decision had removed all pricing from the system entirely. That was reversed — the client wants real price, plus offer/discount display, visible to visitors. `products.price` is a required field.
- **Offers and discounts are two separate tables**, not a boolean flag on the product. `offers` holds the campaign (label, active flag, optional date range); `discounts` holds the actual value (percentage or flat amount) tied to an offer. A product can have at most one offer (`products.offer_id`, nullable FK) — not a many-to-many join.
- **Product images are 1 to 4 per product**, stored as an ordered array of Storage URLs. Editing a product's images **replaces the whole set** — there is no incremental add/remove of individual images in the edit flow.
- **The architecture is a monorepo**, not two separate repos, specifically to share types/schema/Supabase client code between the two apps without duplication.
- **Admin is being built before the public site**, since it's the dependency — there's no catalog to display publicly until admin can create one.

## Who has authority over what

The human developer (Kevsi) makes all product and architectural decisions. An AI agent may implement, and may propose changes, but must not unilaterally alter the schema, the RLS model, the admin/public access boundary, or any decision recorded in this file or the PRD. If a task seems to require such a change, stop and flag it rather than deciding it.

See `AGENT_LOG.md` for the full rules of engagement (security guidelines, change-logging requirements) and `02_SYSTEM_STRUCTURE.md` for how the codebase itself is laid out.
