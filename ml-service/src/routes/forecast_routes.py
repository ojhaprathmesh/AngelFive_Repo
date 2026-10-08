from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.forecast_service import run_forecast

router = APIRouter(tags=["Forecast"])


class ForecastRequest(BaseModel):
    symbol: str = ""
    model: str = "LSTM"
    days: int = 30
    returns: list[float]


@router.post("/forecast")
def generate_forecast(body: ForecastRequest) -> dict[str, Any]:
    symbol = body.symbol.upper()
    model = body.model.upper()

    try:
        forecast_data = run_forecast(
            symbol=symbol, model=model, returns=body.returns, days=body.days
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "status": "success",
        "message": f"Forecast generated successfully for {symbol}",
        "data": {
            **forecast_data,
            "generated_at": datetime.now(UTC).isoformat(),
        },
        "timestamp": datetime.now(UTC).isoformat(),
        "service": "ml-service",
    }
