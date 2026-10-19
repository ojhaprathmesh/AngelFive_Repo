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

  it("should not poison cache when fetchFn throws an error (e.g. rate limit)", async () => {
    let attempts = 0;
    const failingFetch = async () => {
      attempts++;
      throw new Error("SmartAPI candle rate limit exceeded");
    };

    const key = `test:error-cache:${Date.now()}`;
    await assert.rejects(
      () => swrCache.get(key, failingFetch, 10_000),
      /SmartAPI candle rate limit exceeded/,
    );

    // Second call should attempt fresh fetch instead of serving a cached error
    const recoveredFetch = async () => {
      attempts++;
      return [{ close: 25000 }];
    };

    const result = await swrCache.get(key, recoveredFetch, 10_000);
    assert.equal(attempts, 2, "Second attempt must execute fresh supplier");
    assert.deepEqual(result, [{ close: 25000 }]);
    await swrCache.delete(key);
  });
});
