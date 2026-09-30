import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteOfferBanner, OfferBannerInputError, saveOfferBanner } from "../offer-banner-admin";
import { saveBannerWithFeedback } from "../offer-banner-ui";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";

type Row = Record<string, unknown> & { offer_id: string; image_url: string };

class MockSupabase {
  rows = new Map<string, Row>();
  objects = new Set<string>();
  upsertError: Error | null = null;
  upsertCalls = 0;
  removed: string[] = [];

  from(table: string) {
    assert.equal(table, "offer_banners");
    return {
      select: () => ({
        eq: (_column: string, offerId: string) => ({
          maybeSingle: async () => ({ data: this.rows.get(offerId) ?? null, error: null }),
        }),
      }),
      upsert: (values: Row, options: { onConflict: string }) => {
        assert.equal(options.onConflict, "offer_id");
        this.upsertCalls += 1;
        return {
          select: () => ({
            single: async () => {
              if (this.upsertError) return { data: null, error: this.upsertError };
              const current = this.rows.get(values.offer_id);
              const row = {
                id: current?.id ?? `banner-${this.rows.size + 1}`,
                created_at: current?.created_at ?? "2026-01-01T00:00:00.000Z",
                ...current,
                ...values,
              };
              this.rows.set(values.offer_id, row);
              return { data: row, error: null };
            },
          }),
        };
      },
      delete: () => ({
        eq: async (_column: string, offerId: string) => {
          this.rows.delete(offerId);
          return { error: null };
        },
      }),
    };
  }

  storage = {
    from: (bucket: string) => {
      assert.equal(bucket, "product-images");
      return {
        upload: async (path: string) => {
          this.objects.add(path);
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/product-images/${path}` },
        }),
        remove: async (paths: string[]) => {
          this.removed.push(...paths);
          for (const path of paths) this.objects.delete(path);
          return { error: null };
        },
      };
    },
  };
}

function client(mock: MockSupabase): SupabaseClient {
  return mock as unknown as SupabaseClient;
}

function validInput(file: File | null = new File(["image"], "hero image.png", { type: "image/png" })) {
  return {
    offerId: "offer-1",
    productId: "product-1",
    file,
    altText: "  Offer banner  ",
    isActive: true,
    displayOrder: 2,
  };
}

before(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
});

after(() => {
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
});

describe("offer banner persistence", () => {
  it("uploads first and upserts the returned public URL", async () => {
    const mock = new MockSupabase();
    const row = await saveOfferBanner(client(mock), validInput());

    assert.match(row.image_url, /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/product-images\/offer-banners\/offer-1\//);
    assert.equal(row.alt_text, "Offer banner");
    assert.equal(row.product_id, "product-1");
    assert.equal(mock.rows.size, 1);
  });

  it("re-saves the same offer row and removes the replaced file", async () => {
    const mock = new MockSupabase();
    const first = await saveOfferBanner(client(mock), validInput());
    const oldPath = "offer-banners/offer-1/old.png";
    mock.rows.set("offer-1", { ...first, image_url: `https://project.supabase.co/storage/v1/object/public/product-images/${oldPath}` });
    mock.objects.add(oldPath);

    const second = await saveOfferBanner(client(mock), validInput());

    assert.equal(mock.rows.size, 1);
    assert.equal(second.id, first.id);
    assert.ok(mock.removed.includes(oldPath));
    assert.equal(mock.objects.has(oldPath), false);
  });

  it("rejects empty alt text before writing", async () => {
    const mock = new MockSupabase();
    await assert.rejects(
      saveOfferBanner(client(mock), { ...validInput(), altText: "  " }),
      OfferBannerInputError,
    );
    assert.equal(mock.upsertCalls, 0);
  });

  it("rejects unsupported and oversized images before uploading", async () => {
    const mock = new MockSupabase();
    const gif = new File(["image"], "banner.gif", { type: "image/gif" });
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });

    await assert.rejects(saveOfferBanner(client(mock), validInput(gif)), OfferBannerInputError);
    await assert.rejects(saveOfferBanner(client(mock), validInput(oversized)), OfferBannerInputError);
    assert.equal(mock.objects.size, 0);
  });

  it("removes a new upload when the upsert fails", async () => {
    const mock = new MockSupabase();
    mock.upsertError = new Error("database unavailable");

    await assert.rejects(saveOfferBanner(client(mock), validInput()), /database unavailable/);
    assert.equal(mock.objects.size, 0);
    assert.equal(mock.removed.length, 1);
  });

  it("deletes the banner row and its storage file", async () => {
    const mock = new MockSupabase();
    const path = "offer-banners/offer-1/banner.png";
    mock.rows.set("offer-1", {
      offer_id: "offer-1",
      image_url: `https://project.supabase.co/storage/v1/object/public/product-images/${path}`,
    });
    mock.objects.add(path);

    await deleteOfferBanner(client(mock), "offer-1");

    assert.equal(mock.rows.has("offer-1"), false);
    assert.equal(mock.objects.has(path), false);
  });

  it("does not run the UI success callback when saving fails", async () => {
    let successShown = false;
    let errorShown = false;

    await saveBannerWithFeedback(
      async () => { throw new Error("save failed"); },
      () => { successShown = true; },
      () => { errorShown = true; },
    );

    assert.equal(successShown, false);
    assert.equal(errorShown, true);
  });
});