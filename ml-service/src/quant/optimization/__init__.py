import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from pypfopt import efficient_frontier, objective_functions
from pypfopt import EfficientSemivariance
from pypfopt.efficient_frontier import EfficientCVaR
from pypfopt.efficient_frontier import EfficientFrontier
from pypfopt.hierarchical_portfolio import HRPOpt
from src.quant.contracts import PortfolioWeights, PortfolioMetrics

def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def optimize_mpt(
    expected_returns: pd.Series, 
    cov_matrix: pd.DataFrame, 
    weight_bounds: Tuple[float, float] = (0.0, 1.0),
    l2_gamma: float = 0.0,
    target_return: Optional[float] = None,
    target_volatility: Optional[float] = None
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    Optimizes portfolio using standard Efficient Frontier.
    Returns (weights, metrics)
    """
    ef = EfficientFrontier(expected_returns, cov_matrix, weight_bounds=weight_bounds)
    
    # Apply L2 Regularization if requested
    if l2_gamma > 0:
        ef.add_objective(objective_functions.L2_reg, gamma=l2_gamma)
        
    if target_return is not None:
        ef.efficient_return(target_return)
    elif target_volatility is not None:
        ef.efficient_risk(target_volatility)
    else:
        ef.max_sharpe()
        
    weights = ef.clean_weights()
    perf = ef.portfolio_performance()
    
    metrics = {
        "expected_return": _safe_float(perf[0] if len(perf) > 0 else 0.0),
        "volatility": _safe_float(perf[1] if len(perf) > 1 else 0.0),
        "sharpe_ratio": _safe_float(perf[2] if len(perf) > 2 else 0.0)
    }
    
    clean_dict: Dict[str, float] = {str(k): _safe_float(v) for k, v in dict(weights).items()}
    return clean_dict, metrics

def optimize_hrp(returns: pd.DataFrame) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    Optimizes portfolio using Hierarchical Risk Parity.
    Returns (weights, metrics)
    """
    hrp = HRPOpt(returns)
    hrp.optimize()
    weights = hrp.clean_weights()
    perf = hrp.portfolio_performance()
    
    metrics = {
        "expected_return": _safe_float(perf[0] if len(perf) > 0 else 0.0),
        "volatility": _safe_float(perf[1] if len(perf) > 1 else 0.0),
        "sharpe_ratio": _safe_float(perf[2] if len(perf) > 2 else 0.0)
    }
    
    clean_dict: Dict[str, float] = {str(k): _safe_float(v) for k, v in dict(weights).items()}
    return clean_dict, metrics

def optimize_semivariance(
    expected_returns: pd.Series, 
    historical_returns: pd.DataFrame, 
    weight_bounds: Tuple[float, float] = (0.0, 1.0),
    target_return: Optional[float] = None
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    Optimizes portfolio using Efficient Semivariance (downside risk).
    Returns (weights, metrics)
    """
    ef = EfficientSemivariance(expected_returns, historical_returns, weight_bounds=weight_bounds)
    
    if target_return is not None:
        ef.efficient_return(target_return)
    else:
        ef.max_quadratic_utility()
        
    weights = ef.clean_weights()
    perf = ef.portfolio_performance()
    
    metrics = {
        "expected_return": _safe_float(perf[0] if len(perf) > 0 else 0.0),
        "semivariance": _safe_float(perf[1] if len(perf) > 1 else 0.0),
        "sortino_ratio": _safe_float(perf[2] if len(perf) > 2 else 0.0)
    }
    
    clean_dict: Dict[str, float] = {str(k): _safe_float(v) for k, v in dict(weights).items()}
    return clean_dict, metrics

def generate_efficient_frontier(
    expected_returns: pd.Series, 
    cov_matrix: pd.DataFrame, 
    weight_bounds: Tuple[float, float] = (0.0, 1.0),
    points: int = 30
) -> List[Dict[str, Any]]:
    """
    Generates points along the efficient frontier.
    """
    min_vol_ef = EfficientFrontier(expected_returns, cov_matrix, weight_bounds=weight_bounds)
    min_vol_ef.min_volatility()
    perf_min = min_vol_ef.portfolio_performance()
    min_ret = _safe_float(perf_min[0] if len(perf_min) > 0 else 0.0)
    
    max_ret = _safe_float(expected_returns.max())
    
    # Avoid numerical issues
    if max_ret <= min_ret:
        target_returns = [min_ret]
    else:
        target_returns = [_safe_float(x) for x in np.linspace(min_ret, max_ret, points)]
        
    frontier: List[Dict[str, Any]] = []
    
    for target in target_returns:
        try:
            ef = EfficientFrontier(expected_returns, cov_matrix, weight_bounds=weight_bounds)
            ef.efficient_return(target)
            w = ef.clean_weights()
            perf = ef.portfolio_performance()
            
            frontier.append({
                "weights": [_safe_float(v) for v in w.values()],
                "expected_return": _safe_float(perf[0] if len(perf) > 0 else 0.0),
                "volatility": _safe_float(perf[1] if len(perf) > 1 else 0.0),
                "sharpe_ratio": _safe_float(perf[2] if len(perf) > 2 else 0.0)
            })
        except Exception:
            continue
            
    return frontier
