from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter

router = APIRouter(tags=["Models"])

AVAILABLE_MODELS = {
    "LSTM": {"type": "deep-learning", "framework": "PyTorch"},
    "ARIMA": {"type": "statistical", "framework": "statsmodels"},
    "GARCH": {"type": "volatility", "framework": "arch"},
    "FINBERT": {"type": "nlp-sentiment", "framework": "transformers"},
    "RULE_BASED": {"type": "nlp-sentiment", "framework": "custom"},
}


@router.get("/models")
def get_available_models() -> dict[str, Any]:
    return {
        "status": "success",
        "message": "Available models retrieved successfully",
        "data": {
            "models": AVAILABLE_MODELS,
            "count": len(AVAILABLE_MODELS),
            "supported_symbols": ["SENSEX", "NIFTY50"],
        },
        "timestamp": datetime.now(UTC).isoformat(),
        "service": "ml-service",
    }
