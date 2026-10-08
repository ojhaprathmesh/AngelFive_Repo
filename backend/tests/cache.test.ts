import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { swrCache, TTL } from "../src/services/cache";

describe("Cache Service Configuration & Invariants", () => {
  it("should have correct TTL hierarchy matching financial frequency invariants", () => {
    // Live prices must revalidate faster than discovery/performers
    assert.ok(TTL.LIVE_PRICE < TTL.PERFORMERS);
    assert.equal(TTL.LIVE_PRICE, 15_000); // 15 seconds

    // Intraday charts update every minute
    assert.equal(TTL.CHART_INTRADAY, 60_000);

    // Historical bulk candles are cached for 5 minutes
    assert.equal(TTL.CHART_HISTORICAL, 300_000);

    // Instrument Master holds for 12 hours
    assert.equal(TTL.INSTRUMENT_MASTER, 12 * 60 * 60 * 1000);
  });

  it("should coalesce concurrent cold-cache requests into a single in-flight fetch", async () => {
    let callCount = 0;
    const fetchExpensiveData = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { timestamp: Date.now(), items: [1, 2, 3] };
    };

    const key = `test:single-flight:${Date.now()}`;
    // Fire 5 requests concurrently
    const results = await Promise.all([
      swrCache.get(key, fetchExpensiveData, 10_000),
      swrCache.get(key, fetchExpensiveData, 10_000),
      swrCache.get(key, fetchExpensiveData, 10_000),
      swrCache.get(key, fetchExpensiveData, 10_000),
      swrCache.get(key, fetchExpensiveData, 10_000),
    ]);

    assert.equal(callCount, 1, "fetchExpensiveData should only be called once");
    assert.equal(results.length, 5);
    assert.deepEqual(results[0], results[1]);
    await swrCache.delete(key);
  });
});
