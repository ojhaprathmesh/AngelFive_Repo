import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.dsfm_service import (
    acf_pacf,
    adf_test,
    arima_forecast,
    black_litterman_optimize,
    enhanced_sharpe_ratio,
    garch_forecast,
    lstm_forecast,
    mpt_optimize,
)
from src.services.sentiment_service import (
    get_finbert_warmup_status,
    run_finbert_sentiment,
    run_rule_based_sentiment,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["DSFM"])


# ── Request models ────────────────────────────────────────────────────────────


class ReturnsRequest(BaseModel):
    returns: list[float]
    max_lags: int = 20
    order: list[int] = [1, 0, 1]
    horizon: int = 5
    steps: int = 5
    lookback: int = 10
    forecast_steps: int = 5
    risk_free_rate: float = 0.06
    period: str = "daily"


class PortfolioRequest(BaseModel):
    returns: list[list[float]]
    symbols: list[str]
    risk_free_rate: float = 0.06
    risk_aversion: float = 3.0
    tau: float = 0.05
    views: dict[str, float] = {}


class SentimentRequest(BaseModel):
    text: str


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/adf-test")
def adf_test_route(body: ReturnsRequest) -> dict[str, Any]:
    return adf_test(body.returns)


@router.post("/acf-pacf")
def acf_pacf_route(body: ReturnsRequest) -> dict[str, Any]:
    return acf_pacf(body.returns, max_lags=body.max_lags)


@router.post("/arima")
def arima_route(body: ReturnsRequest) -> dict[str, Any]:
    return arima_forecast(body.returns, order=body.order, steps=body.steps)


@router.post("/garch")
def garch_route(body: ReturnsRequest) -> dict[str, Any]:
    return garch_forecast(body.returns, order=body.order[:2], horizon=body.horizon)


@router.post("/lstm")
def lstm_route(body: ReturnsRequest) -> dict[str, Any]:
    warmup = get_finbert_warmup_status()
    if not warmup["started"]:
        raise HTTPException(
            status_code=503,
            detail="ML service is warming up, please retry shortly",
            headers={"Retry-After": "30"},
        )
    try:
        return lstm_forecast(
            returns=body.returns,
            lookback=body.lookback,
            forecast_steps=body.forecast_steps,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sentiment/finbert")
def finbert_route(body: SentimentRequest) -> dict[str, Any]:
    warmup = get_finbert_warmup_status()
    if not warmup["ready"]:
        message = warmup.get("error") or "FinBERT is not ready, please retry shortly"
        raise HTTPException(
            status_code=503,
            detail=message,
            headers={"Retry-After": "20"},
        )
    try:
        return run_finbert_sentiment(body.text)
    except RuntimeError as exc:
        # Covers: HF API timeout, model warming up on HF side, auth errors
        raise HTTPException(
            status_code=503, detail=str(exc), headers={"Retry-After": "20"}
        ) from exc


@router.post("/sentiment/rule-based")
def rule_based_route(body: SentimentRequest) -> dict[str, Any]:
    return run_rule_based_sentiment(body.text)


@router.post("/mpt")
def mpt_route(body: PortfolioRequest) -> dict[str, Any]:
    return mpt_optimize(body.returns, body.symbols, risk_free_rate=body.risk_free_rate)


@router.post("/black-litterman")
def black_litterman_route(body: PortfolioRequest) -> dict[str, Any]:
    return black_litterman_optimize(
        body.returns,
        body.symbols,
        views=body.views,
        risk_aversion=body.risk_aversion,
        tau=body.tau,
    )


@router.post("/sharpe-ratio")
def sharpe_route(body: ReturnsRequest) -> dict[str, Any]:
    return enhanced_sharpe_ratio(
        body.returns,
        risk_free_rate=body.risk_free_rate,
        period=body.period,
    )
