# Avirat Jewelers — Design Tokens (Admin)

Status: DRAFT — proposed starting values for developer/agent review, not yet confirmed by design.
Scope: `apps/admin` only. Same palette/type/motion primitives as the public site's tokens
(avirat-jewelers-design-tokens.md), reused here since the developer confirmed they're shared —
but usage rules differ, since admin is a working tool, not an editorial storefront. The DRD
(Swarovski/Cluely/Breitling editorial pacing) does not apply here; this is a functional dashboard.

---

## 1. Color

Same core palette as public:

| Token | Role | Proposed hex |
|---|---|---|
| `color-primary` | White / base surface | `#FFFFFF` |
| `color-secondary` | Dusky pink | `#D8A8A0` |
| `color-tertiary` | Grey | `#8A8783` |
| `color-quaternary` | Gold | `#B08D57` |
| `color-ink` | Near-black text | `#1A1816` |
| `color-surface-muted` | Off-white | `#F7F4F2` |

**Usage differs from public site:**
- Grey does more work here — table borders, input borders, disabled states, secondary
  buttons — since admin is data-dense and needs quieter chrome than the storefront.
- Gold stays accent-only, but in admin its job is functional signaling (primary action
  buttons, active/selected row, save confirmation) rather than luxury emphasis.
- Dusky pink is used sparingly — active nav item, selected tab, tag/status pills — not as a
  section-background color the way it might be on public. Admin screens are mostly white/grey
  with pink and gold as small pointers to what's active or important.

Semantic colors (same as public, but these get real use here — status badges, form validation):

| Token | Role | Proposed hex |
|---|---|---|
| `color-success` | Saved, published, in stock | `#5B7A5E` |
| `color-warning` | Draft, pending inquiry | `#B08D57` (reuse gold) or `#C4922F` if a distinct warning tone is wanted |
| `color-error` | Validation errors, delete confirmation | `#9C4A42` |
| `color-overlay` | Modal scrim | `rgba(26,24,22,0.6)` |

---

## 2. Typography

Admin is a working tool — legibility and density matter more than editorial confidence, so the
type system leans lighter on Martion Mono than the public site does.

| Token | Family | Usage |
|---|---|---|
| `font-display` | Martion Mono | Page titles only ("Products", "Inquiries") — keeps brand consistency without slowing down scanning |
| `font-body` | Same body font decided for public (TBD) | Table data, form labels, all working UI text |

### Scale (proposed — smaller than public, admin doesn't need hero sizes)

| Token | Size / line-height | Use |
|---|---|---|
| `text-display-md` | 24px / 1.2 | Page titles |
| `text-body-lg` | 16px / 1.5 | Form inputs, primary table content |
| `text-body-md` | 14px / 1.5 | Default body, table rows |
| `text-body-sm` | 12px / 1.4 | Meta/timestamps, helper text |
| `text-label` | 11px / 1.3, uppercase, letter-spacing 0.04em | Table headers, badges, form field labels |

---

## 3. Spacing

Tighter than public site — admin needs density, not the "confidence over density" whitespace
the DRD calls for on the storefront.

| Token | Value |
|---|---|
| `space-xs` | 4px |
| `space-sm` | 8px |
| `space-md` | 16px |
| `space-lg` | 24px |
| `space-xl` | 40px |
| `space-2xl` | 64px — page-section gaps only |

---

## 4. Motion

Same minimal philosophy as public, but even more restrained — admin motion should be near-invisible.

| Token | Value | Use |
|---|---|---|
| `duration-fast` | 100ms | Hover, toggle, checkbox states |
| `duration-base` | 150ms | Panel/drawer open, tab switch |
| `duration-slow` | 250ms | Modal open |
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | All transitions |

No page-transition animation between admin routes — instant navigation is more important than
polish for a tool used daily.

---

## 5. Radius & elevation

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 2px | Buttons, inputs, tags |
| `radius-md` | 4px | Cards, modals, table containers |
| `shadow-card` | `0 1px 2px rgba(26,24,22,0.06)` | Cards |
| `shadow-modal` | `0 4px 16px rgba(26,24,22,0.12)` | Modals, dropdowns — admin needs a bit more separation than public's flat cards, since overlapping panels (dropdowns, drawers) are common in a dashboard |

---

## 6. Open items before implementation

1. Same brand-source confirmation as public tokens — these hex values are placeholders pending
   any real brand asset.
2. Body font decision (shared dependency with public tokens doc) blocks this too.
3. Confirm whether admin needs a dedicated "warning" color distinct from gold, or reusing gold
   for both accent and warning is acceptable — flagged above as a choice, not yet decided.
4. No dark mode assumed here either — confirm, since some admin tools do want a dark mode for
   long data-entry sessions.
