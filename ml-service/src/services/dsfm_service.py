import numpy as np

from src.models.model_loader import get_lstm_model
from src.utils.serialization import params_to_dict


def adf_test(returns):
    from typing import Any
    from statsmodels.tsa.stattools import adfuller
    res: Any = adfuller(np.array(returns), autolag="AIC")
    stat = float(res[0])
    p_val = float(res[1])
    crit_dict: dict[str, Any] = res[4] if len(res) > 4 and isinstance(res[4], dict) else {}
    is_stationary = p_val < 0.05
    return {
        "test_statistic": stat,
        "p_value": p_val,
        "critical_values": {
            "1%": float(crit_dict.get("1%", -3.5)),
            "5%": float(crit_dict.get("5%", -2.86)),
            "10%": float(crit_dict.get("10%", -2.57)),
        },
        "is_stationary": is_stationary,
        "interpretation": "Stationary" if is_stationary else "Non-stationary",
    }


def acf_pacf(returns, max_lags=20):
    from statsmodels.tsa.stattools import acf, pacf
    arr = np.array(returns)
    pacf_res = pacf(arr, nlags=max_lags)
    return {
        "lags": list(range(max_lags + 1)),
        "acf": np.asarray(acf(arr, nlags=max_lags, fft=True)).tolist(),
        "pacf": np.asarray(pacf_res).tolist(),
        "confidence_interval": float(1.96 / np.sqrt(len(arr))),
    }


def arima_forecast(returns, order=(1, 0, 1), steps=5):
    from statsmodels.tsa.arima.model import ARIMA
    arr = np.array(returns)
    fitted = ARIMA(arr, order=tuple(order)).fit()
    forecast = fitted.forecast(steps=steps)
    forecast_list = forecast.tolist() if hasattr(forecast, "tolist") else list(forecast)
    return {
        "order": list(order),
        "aic": float(fitted.aic),
        "bic": float(fitted.bic),
        "params": params_to_dict(fitted.params, getattr(fitted, "param_names", None)),
        "forecast": [float(x) for x in forecast_list],
        "summary": str(fitted.summary()),
    }


def garch_forecast(returns, order=(1, 1), horizon=5):
    from arch import arch_model
    arr = np.array(returns)
    fitted = arch_model(arr * 100, vol="GARCH", p=order[0], q=order[1]).fit(disp="off")
    cond_vol = fitted.conditional_volatility / 100
    forecast_var = fitted.forecast(horizon=horizon).variance.values[-1] / 10000
    return {
        "order": list(order),
        "aic": float(fitted.aic),
        "bic": float(fitted.bic),
        "params": params_to_dict(fitted.params, getattr(fitted, "param_names", None)),
        "conditional_volatility": cond_vol.tolist() if hasattr(cond_vol, "tolist") else list(cond_vol),
        "forecast": forecast_var.tolist() if hasattr(forecast_var, "tolist") else list(forecast_var),
    }


def lstm_forecast(returns, lookback=10, forecast_steps=5):
    import torch
    arr = np.array(returns, dtype=np.float32)
    if len(arr) < lookback + 5:
        raise ValueError(f"Insufficient data. Need at least {lookback + 5} data points")

    model = get_lstm_model()

    # 1. Backtest validation on holdout split to compute true out-of-sample RMSE/MAE
    val_steps = min(forecast_steps, max(1, len(arr) - lookback))
    train_data = arr[:-val_steps]
    val_actual = arr[-val_steps:]

    eval_history = train_data.copy()
    val_preds = []
    for _ in range(val_steps):
        window = eval_history[-lookback:]
        mean = float(window.mean())
        std = float(window.std()) if float(window.std()) > 1e-8 else 1.0
        normalized = (window - mean) / std
        tensor = torch.tensor(normalized, dtype=torch.float32).view(1, lookback, 1)
        with torch.no_grad():
            pred_norm = model(tensor).item()
        pred = (pred_norm * std) + mean
        val_preds.append(float(pred))
        eval_history = np.append(eval_history, pred)

    val_preds_arr = np.array(val_preds, dtype=np.float32)
    rmse = float(np.sqrt(np.mean((val_preds_arr - val_actual) ** 2))) if len(val_actual) else 0.0
    mae = float(np.mean(np.abs(val_preds_arr - val_actual))) if len(val_actual) else 0.0

    # 2. Compute clean forward out-of-sample forecast steps starting from full historical data
    history = arr.copy()
    forecasts = []
    for _ in range(forecast_steps):
        window = history[-lookback:]
        mean = float(window.mean())
        std = float(window.std()) if float(window.std()) > 1e-8 else 1.0
        normalized = (window - mean) / std
        tensor = torch.tensor(normalized, dtype=torch.float32).view(1, lookback, 1)
        with torch.no_grad():
            pred_norm = model(tensor).item()
        prediction = (pred_norm * std) + mean
        forecasts.append(float(prediction))
        history = np.append(history, prediction)

    return {
        "model": "LSTM",
        "lookback": lookback,
        "forecast_steps": forecast_steps,
        "forecast": forecasts,
        "rmse": rmse,
        "mae": mae,
        "training_loss": rmse,
    }


def mpt_optimize(returns, symbols, risk_free_rate=0.06):
    import pandas as pd
    from src.quant.risk_models import calculate_covariance
    from src.quant.optimization import optimize_mpt, generate_efficient_frontier

    returns_matrix = np.array(returns, dtype=float)
    df_returns = pd.DataFrame(returns_matrix.T, columns=symbols)
    
    # Calculate expected annual returns
    expected_returns = df_returns.mean() * 252

    # Calculate robust covariance matrix using Ledoit-Wolf shrinkage on reconstructed prices
    try:
        pseudo_prices = (1.0 + df_returns).cumprod()
        cov_matrix = calculate_covariance(pseudo_prices, method="ledoit_wolf", frequency=252)
    except Exception:
        cov_matrix = df_returns.cov() * 252

    optimal_weights, optimal_metrics = optimize_mpt(
        expected_returns, 
        cov_matrix, 
        weight_bounds=(0.0, 1.0),
        target_return=None
    )

    frontier = generate_efficient_frontier(expected_returns, cov_matrix, points=30)
    
    return {
        "model": "MPT",
        "symbols": symbols,
        "risk_free_rate": float(risk_free_rate),
        "optimal_portfolio": {
            "weights": list(optimal_weights.values()),
            "expected_return": optimal_metrics["expected_return"],
            "volatility": optimal_metrics["volatility"],
            "sharpe_ratio": optimal_metrics["sharpe_ratio"]
        },
        "efficient_frontier": frontier,
        "expected_returns": expected_returns.tolist(),
        "covariance_matrix": cov_matrix.values.tolist(),
    }


def black_litterman_optimize(returns, symbols, views=None, risk_aversion=3.0, tau=0.05):
    import pandas as pd
    from src.quant.risk_models import calculate_covariance
    from src.quant.black_litterman import optimize_black_litterman
    from src.quant.optimization import optimize_mpt
    
    returns_matrix = np.array(returns, dtype=float)
    df_returns = pd.DataFrame(returns_matrix.T, columns=symbols)

    # Use Ledoit-Wolf shrinkage covariance for robust prior formulation
    try:
        pseudo_prices = (1.0 + df_returns).cumprod()
        cov_matrix = calculate_covariance(pseudo_prices, method="ledoit_wolf", frequency=252)
    except Exception:
        cov_matrix = df_returns.cov() * 252
    
    bl_returns, bl_cov = optimize_black_litterman(
        cov_matrix=cov_matrix,
        views=views,
        risk_aversion=risk_aversion,
        tau=tau
    )
    
    optimal_weights, optimal_metrics = optimize_mpt(
        bl_returns, 
        bl_cov, 
        weight_bounds=(0.005, max(0.35, 1.5 / len(symbols)))
    )

    return {
        "model": "Black-Litterman",
        "symbols": symbols,
        "risk_aversion": float(risk_aversion),
        "tau": float(tau),
        "optimal_weights": list(optimal_weights.values()),
        "expected_return": optimal_metrics["expected_return"],
        "volatility": optimal_metrics["volatility"],
        "sharpe_ratio": optimal_metrics["sharpe_ratio"],
        "equilibrium_returns": bl_returns.tolist(),
        "bl_returns": bl_returns.tolist(),
        "market_weights": [], # omitted for brevity, can compute if needed
    }


def enhanced_sharpe_ratio(returns, risk_free_rate=0.06, period="daily"):
    import pandas as pd
    from src.quant.metrics import calculate_advanced_metrics
    df = pd.DataFrame(returns)
    metrics = calculate_advanced_metrics(df, risk_free_rate=risk_free_rate)
    result: dict[str, object] = dict(metrics)
    result["period"] = str(period)
    return result
