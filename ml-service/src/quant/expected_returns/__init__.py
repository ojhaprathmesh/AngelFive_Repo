import pandas as pd
from pypfopt import expected_returns


def calculate_expected_returns(
    prices: pd.DataFrame, method: str = "mean_historical_return", frequency: int = 252
) -> pd.Series:
    """
    Calculate expected returns from a dataframe of prices.

    Args:
        prices: DataFrame of asset prices
        method: The method to use ('mean_historical_return', 'ema_historical_return', 'capm_return')
        frequency: Number of trading days in a year

    Returns:
        pd.Series of expected returns
    """
    if method == "mean_historical_return":
        return expected_returns.mean_historical_return(prices, frequency=frequency)
    elif method == "ema_historical_return":
        return expected_returns.ema_historical_return(prices, frequency=frequency)
    elif method == "capm_return":
        return expected_returns.capm_return(prices, frequency=frequency)
    else:
        return expected_returns.mean_historical_return(prices, frequency=frequency)
