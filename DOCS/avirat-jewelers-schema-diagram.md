# Avirat Jewelers — Schema Diagram

```mermaid
erDiagram
    CATEGORIES ||--o{ PRODUCTS : "has many"
    OFFERS ||--o{ PRODUCTS : "applied to (0 or 1)"
    OFFERS ||--o{ DISCOUNTS : "has"
    PRODUCTS ||--o{ INQUIRIES : "referenced by (0 or many)"
    PRODUCTS ||--o{ VISITS : "referenced by (0 or many)"

    CATEGORIES {
        uuid id PK
        text name
        text icon_url
    }

    PRODUCTS {
        uuid id PK
        text name
        uuid category_id FK
        text description
        boolean hallmark_certified
        enum availability
        numeric price
        uuid offer_id FK "nullable"
        enum status
        text_array image_urls
        timestamptz created_at
        timestamptz updated_at
    }

    OFFERS {
        uuid id PK
        text label
        text description
        boolean is_active
        date start_date
        date end_date
    }

    DISCOUNTS {
        uuid id PK
        uuid offer_id FK
        enum discount_type
        numeric value
    }

    INQUIRIES {
        uuid id PK
        text name
        text phone
        text email
        text message
        uuid product_id FK "nullable"
        enum status
        timestamptz created_at
    }

    VISITS {
        uuid id PK
        text page_path
        uuid product_id "nullable, no FK constraint"
        timestamptz created_at
    }
```

## Relationship notes

- **categories → products**: one-to-many. Every product has exactly one category (single FK, not multi-category).
- **offers → products**: one-to-many, but capped at one active offer per product in practice — `products.offer_id` is nullable, a product may have zero or one offer.
- **offers → discounts**: one-to-many. A `discount_type` + `value` row is tied to a specific offer (percentage or flat amount).
- **products → inquiries**: one-to-many, nullable FK. An inquiry may or may not originate from a specific product page.
- **products → visits**: one-to-many, nullable, used for analytics tracking only — not a strict FK constraint since visit rows should still be recorded even if referencing a product loosely.

## Access summary (from PRD §5)

| Table | Public read | Public write | Admin |
|---|---|---|---|
| products | ✅ (status='published' only) | ❌ | full CRUD |
| categories | ✅ | ❌ | full CRUD |
| offers | ✅ | ❌ | full CRUD |
| discounts | ✅ | ❌ | full CRUD |
| inquiries | ❌ | ✅ (insert only) | read + status update |
| visits | ❌ | ✅ (insert only) | read only |
