import pandas as pd
from pypfopt import BlackLittermanModel, black_litterman


def optimize_black_litterman(
    cov_matrix: pd.DataFrame,
    market_prices: pd.Series | None = None,
    market_caps: dict[str, float] | None = None,
    views: dict[str, float] | None = None,
    confidences: list[float] | None = None,
    risk_aversion: float = 3.0,
    tau: float = 0.05,
) -> tuple[pd.Series, pd.DataFrame]:
    """
    Computes the Black-Litterman expected returns and covariance matrix.

    Args:
        cov_matrix: pd.DataFrame of covariance
        market_prices: Optional pd.Series of market prices
        market_caps: Optional Dict of market capitalizations for the assets
        views: Optional Dict of absolute views (e.g. {"RELIANCE": 0.15})
        confidences: Optional List of confidences for the views
        risk_aversion: Risk aversion parameter
        tau: Scalar indicating uncertainty of the prior

    Returns:
        (expected_returns, covariance_matrix)
    """
    # If market caps provided, use them for market weights
    if market_caps is not None:
        mcaps = pd.Series(market_caps)
        market_weights = mcaps / mcaps.sum()
    else:
        # Equal weights as fallback prior if no market caps
        n = len(cov_matrix.columns)
        market_weights = pd.Series(1 / n, index=cov_matrix.columns)

    # Calculate market-implied prior returns
    prior_returns = black_litterman.market_implied_prior_returns(
        market_weights, risk_aversion, cov_matrix
    )

    if views is None or len(views) == 0:
        return prior_returns, cov_matrix

    # Initialize the BL model
    bl = BlackLittermanModel(
        cov_matrix,
        pi=prior_returns,
        absolute_views=views,
        omega="idzorek",
        view_confidences=confidences,
        tau=tau,
    )

    # Return posterior estimate of returns and covariance
    return bl.bl_returns(), bl.bl_cov()
