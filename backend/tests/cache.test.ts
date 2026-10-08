import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TTL } from "../src/services/cache";

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
});
