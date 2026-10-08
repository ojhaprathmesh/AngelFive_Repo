import numpy as np
import pandas as pd


def calculate_portfolio_metrics(
    weights: dict[str, float],
    expected_returns_series: pd.Series,
    cov_matrix: pd.DataFrame,
    risk_free_rate: float = 0.06,
) -> dict[str, float]:
    """
    Standardized metrics calculation for a given portfolio of weights.
    """
    weights_arr = np.array(
        [weights.get(sym, 0.0) for sym in expected_returns_series.index]
    )

    port_return = weights_arr.T @ expected_returns_series.values
    port_vol = np.sqrt(weights_arr.T @ cov_matrix.values @ weights_arr)

    sharpe = (port_return - risk_free_rate) / port_vol if port_vol > 0 else 0.0

    return {
        "expected_return": float(port_return),
        "volatility": float(port_vol),
        "sharpe_ratio": float(sharpe),
    }


def calculate_advanced_metrics(
    returns: pd.DataFrame, risk_free_rate: float = 0.06
) -> dict[str, float]:
    """
    Calculates advanced metrics from historical portfolio returns.
    """
    arr = np.array(returns, dtype=float)
    mean_return = np.mean(arr)
    std_return = np.std(arr)

    scale = 252
    annual_mean = mean_return * scale
    annual_std = std_return * np.sqrt(scale)
    excess = annual_mean - risk_free_rate
    sharpe = excess / annual_std if annual_std > 0 else 0

    downside = arr[arr < 0]
    downside_std = np.std(downside) if len(downside) > 0 else std_return
    downside_annual = downside_std * np.sqrt(scale)
    sortino = excess / downside_annual if downside_annual > 0 else 0
    info = excess / annual_std if annual_std > 0 else 0

    return {
        "risk_free_rate": float(risk_free_rate),
        "mean_return": float(mean_return),
        "std_return": float(std_return),
        "annualized_mean": float(annual_mean),
        "annualized_std": float(annual_std),
        "excess_return": float(excess),
        "sharpe_ratio": float(sharpe),
        "sortino_ratio": float(sortino),
        "information_ratio": float(info),
    }
