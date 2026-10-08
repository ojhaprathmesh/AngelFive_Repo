from pydantic import BaseModel, Field


class PortfolioWeights(BaseModel):
    """Mapping of asset symbols to their optimized weights"""

    weights: dict[str, float] = Field(..., description="Asset weights summing to 1.0")


class PortfolioMetrics(BaseModel):
    """Standardized portfolio performance metrics"""

    expected_return: float = Field(..., description="Annualized expected return")
    volatility: float = Field(..., description="Annualized volatility (risk)")
    sharpe_ratio: float = Field(..., description="Risk-adjusted return (Sharpe ratio)")
    sortino_ratio: float | None = None
    max_drawdown: float | None = None


class OptimizationConstraints(BaseModel):
    """Constraints for the optimizer"""

    min_weight: float = Field(0.0, description="Minimum weight per asset")
    max_weight: float = Field(1.0, description="Maximum weight per asset")
    target_return: float | None = Field(
        None, description="Target return for efficient risk optimization"
    )
    target_volatility: float | None = Field(
        None, description="Target volatility for efficient return optimization"
    )
    l2_gamma: float = Field(
        0.0, description="L2 regularization parameter to reduce concentration"
    )


class BlackLittermanView(BaseModel):
    """Structured investor view for Black-Litterman"""

    asset: str
    view: str = Field(..., description="'bullish', 'bearish', or specific return value")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence level of the view (0 to 1)"
    )


class BlackLittermanViews(BaseModel):
    """Collection of investor views"""

    views: list[BlackLittermanView]


class RiskModelResult(BaseModel):
    """Output from covariance shrinkage or other risk models"""

    covariance_matrix: list[list[float]]
    assets: list[str]


class AllocationResult(BaseModel):
    """Discrete allocation result"""

    shares: dict[str, int] = Field(
        ..., description="Number of shares to buy/hold per asset"
    )
    leftover_cash: float = Field(..., description="Remaining cash after allocation")
