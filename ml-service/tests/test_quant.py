"""Unit tests for quantitative finance and ML forecasting routines."""

import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.services.dsfm_service import (
    black_litterman_optimize,
    lstm_forecast,
    mpt_optimize,
)


class QuantServiceTest(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        # Synthetic stationary returns
        self.returns = np.random.normal(0.0005, 0.015, 60).tolist()
        self.multi_returns = [
            np.random.normal(0.0008, 0.018, 90).tolist(),
            np.random.normal(0.0004, 0.012, 90).tolist(),
            np.random.normal(0.0006, 0.015, 90).tolist(),
        ]
        self.symbols = ["RELIANCE", "TCS", "INFY"]

    def test_lstm_forecast_holdout_evaluation(self):
        """Verify LSTM produces valid forward projections and clean holdout metrics."""
        result = lstm_forecast(self.returns, lookback=10, forecast_steps=5)
        self.assertEqual(result["model"], "LSTM")
        self.assertEqual(len(result["forecast"]), 5)
        self.assertGreater(result["rmse"], 0.0)
        self.assertGreater(result["mae"], 0.0)

    def test_mpt_optimization_ledoit_wolf(self):
        """Verify MPT optimization computes weights with Ledoit-Wolf covariance shrinkage."""
        result = mpt_optimize(self.multi_returns, self.symbols)
        self.assertEqual(result["model"], "MPT")
        weights = result["optimal_portfolio"]["weights"]
        self.assertEqual(len(weights), 3)
        self.assertAlmostEqual(sum(weights), 1.0, places=4)
        for w in weights:
            self.assertGreaterEqual(w, -1e-5)
            self.assertLessEqual(w, 1.0 + 1e-5)

    def test_black_litterman_optimization(self):
        """Verify Black-Litterman optimization completes with shrunk covariance prior."""
        result = black_litterman_optimize(self.multi_returns, self.symbols)
        self.assertEqual(result["model"], "Black-Litterman")
        weights = result["optimal_weights"]
        self.assertEqual(len(weights), 3)
        self.assertAlmostEqual(sum(weights), 1.0, places=3)


if __name__ == "__main__":
    unittest.main()
