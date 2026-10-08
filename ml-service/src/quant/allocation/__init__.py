import pandas as pd
from pypfopt.discrete_allocation import DiscreteAllocation


def allocate_portfolio(
    weights: dict[str, float],
    latest_prices: pd.Series,
    total_portfolio_value: float = 10000.0,
    short_ratio: float = 0.0,
) -> tuple[dict[str, int], float]:
    """
    Translates continuous weights into discrete share allocations.

    Args:
        weights: Dictionary mapping asset symbols to their fractional weights
        latest_prices: Series mapping asset symbols to their latest price
        total_portfolio_value: Total value to invest
        short_ratio: Short ratio limit

    Returns:
        (Dict of share quantities, leftover cash)
    """
    da = DiscreteAllocation(
        weights,
        latest_prices,
        total_portfolio_value=total_portfolio_value,
        short_ratio=short_ratio,
    )
    allocation, leftover = da.lp_portfolio()
    return allocation, leftover
