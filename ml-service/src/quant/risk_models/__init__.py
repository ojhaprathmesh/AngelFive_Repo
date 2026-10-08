import pandas as pd
from pypfopt import risk_models


def calculate_covariance(
    prices: pd.DataFrame, method: str = "ledoit_wolf", frequency: int = 252
) -> pd.DataFrame:
    """
    Calculate covariance matrix using robust shrinkage methods.

    Args:
        prices: DataFrame of asset prices
        method: The shrinkage method to use ('ledoit_wolf', 'oracle_approximating', 'sample_cov')
        frequency: Number of trading days in a year

    Returns:
        pd.DataFrame covariance matrix
    """
    if method == "ledoit_wolf":
        return risk_models.CovarianceShrinkage(
            prices, frequency=frequency
        ).ledoit_wolf()
    elif method == "oracle_approximating":
        return risk_models.CovarianceShrinkage(
            prices, frequency=frequency
        ).oracle_approximating()
    elif method == "sample_cov":
        return risk_models.sample_cov(prices, frequency=frequency)
    else:
        return risk_models.CovarianceShrinkage(
            prices, frequency=frequency
        ).ledoit_wolf()
