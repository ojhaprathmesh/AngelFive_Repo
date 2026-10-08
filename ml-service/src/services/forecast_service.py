from src.services.dsfm_service import arima_forecast, garch_forecast, lstm_forecast

SUPPORTED_FORECAST_MODELS = {"ARIMA", "GARCH", "LSTM"}
SUPPORTED_SYMBOLS = {"SENSEX", "NIFTY50"}


def run_forecast(symbol, model, returns, days=30):
    if symbol.upper() not in SUPPORTED_SYMBOLS:
        raise ValueError(f"Symbol '{symbol}' not supported. Available: SENSEX, NIFTY50")

    model_upper = model.upper()
    if model_upper not in SUPPORTED_FORECAST_MODELS:
        raise ValueError(
            f"Model '{model}' not available. Available: {', '.join(sorted(SUPPORTED_FORECAST_MODELS))}"
        )

    if model_upper == "ARIMA":
        result = arima_forecast(returns, order=(1, 0, 1), steps=days)
    elif model_upper == "GARCH":
        result = garch_forecast(returns, order=(1, 1), horizon=days)
    else:
        result = lstm_forecast(
            returns, lookback=min(10, max(5, len(returns) // 3)), forecast_steps=days
        )

    return {
        "symbol": symbol.upper(),
        "model": model_upper,
        "forecast_period": f"{days} days",
        "forecast": result.get("forecast", []),
    }
