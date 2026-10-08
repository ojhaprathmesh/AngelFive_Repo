"""Smoke unit tests for ML service initialization and route registration."""

import os
import sys
import unittest

# Ensure ml-service root is on sys.path regardless of execution context
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from src import create_app


class MLServiceSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app)

    def test_app_metadata(self):
        """Verify FastAPI app instance metadata."""
        self.assertEqual(self.app.title, "AngelFive ML Service")
        self.assertEqual(self.app.version, "3.0.0")

    def test_health_endpoint(self):
        """Verify /health endpoint returns 200 and valid JSON schema."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("service"), "ml-service")
        self.assertIn("version", data)

    def test_routes_registered(self):
        """Verify core quantitative and forecast routes are registered in OpenAPI schema."""
        paths = list(self.app.openapi().get("paths", {}).keys())
        self.assertIn("/health", paths)
        self.assertIn("/forecast", paths)
        self.assertIn("/models", paths)
        self.assertIn("/dsfm/adf-test", paths)
        self.assertIn("/dsfm/arima", paths)
        self.assertIn("/dsfm/garch", paths)
        self.assertIn("/dsfm/lstm", paths)
        self.assertIn("/dsfm/mpt", paths)
        self.assertIn("/dsfm/black-litterman", paths)
        self.assertIn("/dsfm/sentiment/finbert", paths)


if __name__ == "__main__":
    unittest.main()
