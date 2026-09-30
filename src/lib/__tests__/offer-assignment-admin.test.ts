import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyOfferAssignment,
  clearOfferAssignments,
  prepareOfferAssignment,
} from "../offer-assignment-admin";
import { computeOfferPrice } from "../offer-price";
import { recomputeAllOfferPrices, recomputeOfferPrices } from "../offer-price-admin";
import { formatOfferAssignmentConfirmation, formatOfferOverrideWarning, readOfferAssignmentPreview } from "../offer-assignment-ui";

type MockProduct = {
  id: string;
  offer_id: string | null;
  price: number;
  price_auto_calculated?: boolean;
  material_type?: string | null;
  purity_carats?: number | null;
  weight_grams?: number | null;
  making_charge_type?: string | null;
  making_charge_percent?: number | null;
  making_charge_flat?: number | null;
  gold_price_used?: number | null;
  gst_percent?: number | null;
  offer_price?: number | null;
};

type MockOffer = {
  id: string;
  label: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  discounts: Array<{ id: string; offer_id: string; discount_type: "percentage" | "flat" | "making_charge"; value: number }>;
};

class MockSupabase {
  products = new Map<string, MockProduct>();
  offers = new Map<string, MockOffer>();
  rpcCalls = 0;
  rpcError: Error | null = null;

  from(table: string) {
    if (table === "offers") {
      return {
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => ({ data: this.offers.get(id) ?? null, error: null }),
          }),
          in: async (_column: string, ids: string[]) => ({
            data: ids.flatMap((id) => {
              const offer = this.offers.get(id);
              return offer ? [offer] : [];
            }),
            error: null,
          }),
        }),
      };
    }
    assert.equal(table, "products");
    return {
      select: () => ({
        in: async (_column: string, ids: string[]) => ({
          data: ids.flatMap((id) => this.products.has(id) ? [this.products.get(id)] : []),
          error: null,
        }),
        order: () => ({
          eq: (_column: string, offerId: string) => ({
            range: async (start: number, end: number) => ({
              data: [...this.products.values()]
                .filter((product) => product.offer_id === offerId)
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(start, end + 1),
              error: null,
            }),
          }),
          range: async (start: number, end: number) => ({
            data: [...this.products.values()].sort((a, b) => a.id.localeCompare(b.id)).slice(start, end + 1),
            error: null,
          }),
        }),
        eq: (_column: string, offerId: string) => ({
          order: () => ({
            range: async (start: number, end: number) => ({
              data: [...this.products.values()]
                .filter((product) => product.offer_id === offerId)
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(start, end + 1),
              error: null,
            }),
          }),
        }),
        not: () => ({
          order: () => ({
            range: async (start: number, end: number) => ({
              data: [...this.products.values()]
                .filter((product) => product.offer_id !== null)
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(start, end + 1),
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  async rpc(name: string, args: { p_items: Array<{ id: string; offer_id: string | null; offer_price: number | null }> }) {
    assert.equal(name, "apply_offer_prices");
    this.rpcCalls += 1;
    if (this.rpcError) return { data: null, error: this.rpcError };
    for (const item of args.p_items) {
      const product = this.products.get(item.id);
      if (!product) return { data: null, error: new Error("product missing") };
    }
    for (const item of args.p_items) {
      this.products.set(item.id, { ...this.products.get(item.id)!, offer_id: item.offer_id, offer_price: item.offer_price });
    }
    return { data: args.p_items.length, error: null };
  }
}

function client(mock: MockSupabase): SupabaseClient {
  return mock as unknown as SupabaseClient;
}

function addOffer(mock: MockSupabase, id: string, label: string, value: number, active = true, startDate: string | null = null, endDate: string | null = null) {
  mock.offers.set(id, {
    id,
    label,
    is_active: active,
    start_date: startDate,
    end_date: endDate,
    discounts: [{ id: `${id}-discount`, offer_id: id, discount_type: "percentage", value }],
  });
}

function addProduct(mock: MockSupabase, id: string, offerId: string | null, price = 1000) {
  mock.products.set(id, { id, offer_id: offerId, price, offer_price: null });
}

async function apply(mock: MockSupabase, offerId: string, productIds?: string[]) {
  const plan = await prepareOfferAssignment(client(mock), offerId, productIds);
  return applyOfferAssignment(client(mock), plan, true);
}

describe("offer assignment planning and atomic write", () => {
  it("applies offer A then B to all products and replaces every assignment", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Offer A", 10);
    addOffer(mock, "offer-b", "Offer B", 20);
    addProduct(mock, "x", null);
    addProduct(mock, "y", "offer-a");

    await apply(mock, "offer-a");
    const preview = await prepareOfferAssignment(client(mock), "offer-b");
    assert.equal(preview.conflicts, 2);
    await applyOfferAssignment(client(mock), preview, true);

    assert.deepEqual([...mock.products.values()].map((item) => [item.offer_id, item.offer_price]), [
      ["offer-b", 800],
      ["offer-b", 800],
    ]);
  });

  it("keeps separate assignments until the same product is explicitly switched", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Offer A", 10);
    addOffer(mock, "offer-b", "Offer B", 20);
    addProduct(mock, "x", null);
    addProduct(mock, "y", null);

    await apply(mock, "offer-a", ["x"]);
    await apply(mock, "offer-b", ["y"]);
    await apply(mock, "offer-b", ["x"]);

    assert.equal(mock.products.get("x")?.offer_id, "offer-b");
    assert.equal(mock.products.get("y")?.offer_id, "offer-b");
  });

  it("changes only selected products", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Offer A", 10);
    addOffer(mock, "offer-b", "Offer B", 20);
    addProduct(mock, "x", "offer-a");
    addProduct(mock, "y", "offer-a");

    await apply(mock, "offer-b", ["x"]);

    assert.equal(mock.products.get("x")?.offer_id, "offer-b");
    assert.equal(mock.products.get("y")?.offer_id, "offer-a");
  });

  it("returns grouped conflicts without writing until confirmed; same-offer assignments are not conflicts", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Offer A", 10);
    addOffer(mock, "offer-b", "Offer B", 20);
    addProduct(mock, "x", "offer-a");
    addProduct(mock, "y", "offer-a");
    addProduct(mock, "z", "offer-b");

    const preview = await prepareOfferAssignment(client(mock), "offer-b");
    assert.equal(preview.conflicts, 2);
    assert.deepEqual(preview.byOffer, [{ offerId: "offer-a", label: "Offer A", productCount: 2 }]);
    await applyOfferAssignment(client(mock), preview, false);
    assert.equal(mock.rpcCalls, 0);

    const sameOffer = await prepareOfferAssignment(client(mock), "offer-b", ["z"]);
    assert.equal(sameOffer.conflicts, 0);
    assert.deepEqual(sameOffer.byOffer, []);
  });

  it("formats the override confirmation with offer labels and counts", () => {
    assert.equal(
      formatOfferOverrideWarning(3, [{ offerId: "a", label: "Offer A", productCount: 2 }, { offerId: "b", label: "Offer B", productCount: 1 }]),
      "This will replace the existing offer on 3 products (Offer A: 2 products, Offer B: 1 products). Their current offers will be removed from those products.",
    );
    assert.deepEqual(readOfferAssignmentPreview({
      conflicts: 1,
      productCount: 1,
      byOffer: [{ offerId: "a", label: "Offer A", productCount: 1 }],
    }), {
      conflicts: 1,
      productCount: 1,
      byOffer: [{ offerId: "a", label: "Offer A", productCount: 1 }],
    });
    assert.equal(formatOfferAssignmentConfirmation("all", "Offer A", {
      conflicts: 0,
      byOffer: [],
      productCount: 8,
    }), "Apply to all 8 products?");
  });

  it("keeps offer_id but stores null for inactive, expired, and future offers", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Inactive", 10, false);
    addOffer(mock, "offer-b", "Expired", 10, true, null, "2000-01-01");
    addOffer(mock, "offer-c", "Future", 10, true, "2999-01-01");
    addProduct(mock, "x", null);

    for (const offerId of ["offer-a", "offer-b", "offer-c"]) {
      await apply(mock, offerId, ["x"]);
      assert.equal(mock.products.get("x")?.offer_id, offerId);
      assert.equal(mock.products.get("x")?.offer_price, null);
    }
  });

  it("activating a future offer recomputes its already-assigned product price", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Offer A", 10, true, "2999-01-01");
    addProduct(mock, "x", null);
    await apply(mock, "offer-a", ["x"]);
    assert.equal(mock.products.get("x")?.offer_price, null);

    mock.offers.get("offer-a")!.start_date = "2000-01-01";
    const result = await recomputeOfferPrices(client(mock), "offer-a");

    assert.deepEqual(result, { updated: 1, error: null });
    assert.equal(mock.products.get("x")?.offer_id, "offer-a");
    assert.equal(mock.products.get("x")?.offer_price, 900);
  });

  it("treats the end date as expired at its exact date boundary", () => {
    const today = new Date().toISOString().slice(0, 10);
    const price = computeOfferPrice(
      { price: 1000 },
      { is_active: true, start_date: null, end_date: today },
      { id: "d", offer_id: "o", discount_type: "percentage", value: 10 },
      {},
    );
    assert.equal(price, null);
  });

  it("recomputes all assigned products when offer discounts or product inputs change", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Offer A", 10);
    addProduct(mock, "x", "offer-a", 1000);
    addProduct(mock, "y", "offer-a", 2000);

    const initial = await prepareOfferAssignment(client(mock), "offer-a");
    assert.deepEqual(initial.items.map((item) => item.offer_price), [900, 1800]);
    mock.offers.get("offer-a")!.discounts[0].value = 25;
    const updatedDiscount = await prepareOfferAssignment(client(mock), "offer-a");
    assert.deepEqual(updatedDiscount.items.map((item) => item.offer_price), [750, 1500]);

    mock.products.get("x")!.price = 1200;
    const updatedProduct = await prepareOfferAssignment(client(mock), "offer-a", ["x"]);
    assert.equal(updatedProduct.items[0].offer_price, 900);

    const recomputed = await recomputeOfferPrices(client(mock), "offer-a");
    assert.deepEqual(recomputed, { updated: 2, error: null });
    assert.equal(mock.products.get("x")?.offer_price, 900);
    assert.equal(mock.products.get("y")?.offer_price, 1500);
  });

  it("uses the same formula when metal rates or making-charge inputs change", () => {
    const offer = { is_active: true, start_date: null, end_date: null };
    const discount = { id: "d", offer_id: "o", discount_type: "making_charge" as const, value: 10 };
    const product = {
      price: 1200,
      price_auto_calculated: true,
      material_type: "gold",
      weight_grams: 1,
      making_charge_type: "percent",
      gold_price_used: 1000,
      gst_percent: 5,
    };
    const original = computeOfferPrice(product, offer, discount, {});
    const newRate = computeOfferPrice({ ...product, gold_price_used: 1100 }, offer, discount, {});
    const newWeight = computeOfferPrice({ ...product, weight_grams: 1.2 }, offer, discount, {});
    assert.notEqual(newRate, original);
    assert.notEqual(newWeight, original);
  });

  it("recomputes stored offer prices after a metal rate changes", async () => {
    const mock = new MockSupabase();
    mock.offers.set("offer-a", {
      id: "offer-a",
      label: "Offer A",
      is_active: true,
      start_date: null,
      end_date: null,
      discounts: [{ id: "d", offer_id: "offer-a", discount_type: "making_charge", value: 10 }],
    });
    mock.products.set("x", {
      id: "x",
      offer_id: "offer-a",
      price: 1400,
      price_auto_calculated: true,
      material_type: "gold",
      weight_grams: 1,
      making_charge_type: "percent",
      gold_price_used: 1000,
      gst_percent: 5,
    });
    const before = computeOfferPrice(mock.products.get("x")!, mock.offers.get("offer-a")!, mock.offers.get("offer-a")!.discounts, {});
    mock.products.get("x")!.gold_price_used = 1100;
    const expected = computeOfferPrice(mock.products.get("x")!, mock.offers.get("offer-a")!, mock.offers.get("offer-a")!.discounts, {});

    const result = await recomputeAllOfferPrices(client(mock));

    assert.deepEqual(result, { updated: 1, error: null });
    assert.notEqual(expected, before);
    assert.equal(mock.products.get("x")?.offer_price, expected);
  });

  it("clears both assignment fields through the atomic RPC", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Offer A", 10);
    addProduct(mock, "x", "offer-a", 1000);
    mock.products.get("x")!.offer_price = 900;

    await clearOfferAssignments(client(mock), "offer-a");

    assert.equal(mock.products.get("x")?.offer_id, null);
    assert.equal(mock.products.get("x")?.offer_price, null);
  });

  it("leaves every product unchanged when the atomic transaction fails", async () => {
    const mock = new MockSupabase();
    addOffer(mock, "offer-a", "Offer A", 10);
    addProduct(mock, "x", null);
    addProduct(mock, "y", null);
    const before = structuredClone([...mock.products.values()]);
    mock.rpcError = new Error("transaction failed");
    const plan = await prepareOfferAssignment(client(mock), "offer-a");

    await assert.rejects(applyOfferAssignment(client(mock), plan, true), /transaction failed/);
    assert.deepEqual([...mock.products.values()], before);
  });
});