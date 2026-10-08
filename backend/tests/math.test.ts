import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateCorrelation,
  calculateLogReturns,
  calculateStatistics,
} from "../src/utils/market-data";

describe("Financial Math Utilities", () => {
  describe("calculateLogReturns", () => {
    it("should accurately compute logarithmic returns: ln(P_t / P_{t-1})", () => {
      const prices = [100, 105, 110.25];
      const returns = calculateLogReturns(prices);

      assert.equal(returns.length, 2);
      // ln(105 / 100) ≈ 0.048790164
      assert.ok(Math.abs(returns[0] - Math.log(105 / 100)) < 1e-7);
      // ln(110.25 / 105) ≈ 0.048790164
      assert.ok(Math.abs(returns[1] - Math.log(110.25 / 105)) < 1e-7);
    });

    it("should return empty array for single price or empty input", () => {
      assert.deepEqual(calculateLogReturns([]), []);
      assert.deepEqual(calculateLogReturns([100]), []);
    });

    it("should safely ignore zero or negative price inputs to avoid NaN / -Infinity", () => {
      const invalidPrices = [100, 0, -5, 105];
      const returns = calculateLogReturns(invalidPrices);
      assert.ok(returns.every((r) => isFinite(r)));
    });
  });

  describe("calculateStatistics", () => {
    it("should compute accurate distribution moments: mean, std, skewness, kurtosis", () => {
      const sampleReturns = [0.01, 0.02, -0.01, 0.03, -0.02];
      const stats = calculateStatistics(sampleReturns);

      assert.ok(isFinite(stats.mean));
      assert.ok(stats.std > 0);
      assert.equal(stats.min, -0.02);
      assert.equal(stats.max, 0.03);
      assert.ok(isFinite(stats.skewness));
      assert.ok(isFinite(stats.kurtosis));
    });

    it("should handle empty returns array gracefully without throwing", () => {
      const stats = calculateStatistics([]);
      assert.deepEqual(stats, {
        mean: 0,
        std: 0,
        skewness: 0,
        kurtosis: 0,
        min: 0,
        max: 0,
      });
    });
  });

  describe("calculateCorrelation", () => {
    it("should return 1.0 for perfectly co-moving series", () => {
      const seriesA = [0.01, 0.02, 0.03, 0.04, 0.05];
      const seriesB = [0.02, 0.04, 0.06, 0.08, 0.1];
      const corr = calculateCorrelation(seriesA, seriesB);

      assert.ok(Math.abs(corr - 1.0) < 1e-6);
    });

    it("should return -1.0 for perfectly inverse series", () => {
      const seriesA = [0.01, 0.02, 0.03, 0.04, 0.05];
      const seriesB = [-0.01, -0.02, -0.03, -0.04, -0.05];
      const corr = calculateCorrelation(seriesA, seriesB);

      assert.ok(Math.abs(corr - -1.0) < 1e-6);
    });

    it("should return 0 for mismatched lengths or empty series", () => {
      assert.equal(calculateCorrelation([], []), 0);
      assert.equal(calculateCorrelation([1, 2], [1]), 0);
    });
  });
});
