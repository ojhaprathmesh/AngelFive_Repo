import { ENV } from "../config/env";
import { logger } from "../lib/logger";
import { fetchNSEIndex } from "../lib/nse";
import {
  calculateCorrelation,
  calculateLogReturns,
  calculateStatistics,
  calculateSymmetricEigenvalues,
  fetchAngelHistoricalCandles,
  fetchPricesAndLogReturns,
  fetchStockReturnsMatrix,
  fetchYahooFinanceData,
} from "../utils/market-data";
import { mlFetch } from "../utils/mlFetch";

const mlServiceUrl = ENV.ML_SERVICE_URL;

export async function processReturns(symbol: string, timeframe: string) {
  let result = await fetchYahooFinanceData(symbol, timeframe);

  if (result.error || result.candles.length === 0) {
    logger.info(`Yahoo Finance failed for ${symbol}, trying Angel One...`);
    result = await fetchAngelHistoricalCandles(symbol, timeframe);
  }

  if (result.error) {
    throw new Error(result.error);
  }

  const candles = result.candles;
  const prices = candles.map((candle) => candle.close);
  const timestamps = candles.map((candle) => candle.time);

  if (prices.length === 0) {
    throw new Error(`No historical data found for ${symbol}.`);
  }

  const logReturns = calculateLogReturns(prices);

  if (logReturns.length === 0) {
    throw new Error("Insufficient data to calculate returns");
  }

  const stats = calculateStatistics(logReturns);

  const annualizedMean = stats.mean * 252;
  const annualizedStd = stats.std * Math.sqrt(252);
  const riskFreeRate = 0.06;
  const sharpeRatio =
    annualizedStd > 0 ? (annualizedMean - riskFreeRate) / annualizedStd : 0;

  return {
    symbol,
    meanReturn: stats.mean,
    volatility: stats.std,
    sharpeRatio: isFinite(sharpeRatio) ? Math.max(0, sharpeRatio) : 0,
    skewness: stats.skewness,
    kurtosis: stats.kurtosis,
    minReturn: stats.min,
    maxReturn: stats.max,
    logReturns: logReturns,
    prices: prices,
    timestamps: timestamps,
    priceCount: prices.length,
    returnCount: logReturns.length,
    calculations: {
      meanReturn: {
        formula: "μ = (1/n) * Σ(returns)",
        description: "Average daily log return",
        value: stats.mean,
      },
      volatility: {
        formula: "σ = √(Σ(returns - μ)² / n)",
        description: "Standard deviation of returns (risk measure)",
        value: stats.std,
      },
      sharpeRatio: {
        formula: "Sharpe = (μ_annual - r_f) / σ_annual",
        description: "Risk-adjusted return (higher is better)",
        value: isFinite(sharpeRatio) ? sharpeRatio : 0,
      },
      range: {
        formula: "Range = [min(returns), max(returns)]",
        description: "Minimum and maximum daily returns",
        value: { min: stats.min, max: stats.max },
      },
    },
  };
}

export async function processCorrelation(timeframe: string) {
  logger.info(`Starting correlation analysis for NIFTY 50 (${timeframe})`);

  const rows = await fetchNSEIndex("NIFTY 50");
  if (!rows || rows.length === 0) {
    throw new Error("Failed to fetch NIFTY 50 index data");
  }

  const allStocks = rows
    .map((r: any) => String(r?.symbol || r?.tradingSymbol || ""))
    .filter((s) => s.length > 0 && !s.includes("NIFTY"));

  logger.info(`Found ${allStocks.length} stocks in NIFTY 50`);

  const stockReturns: { symbol: string; returns: number[] }[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const symbol of allStocks) {
    try {
      let result = await fetchYahooFinanceData(symbol, timeframe);
      if (result.error || result.candles.length === 0) {
        result = await fetchAngelHistoricalCandles(symbol, timeframe);
      }

      if (result.error) {
        logger.warn(`Skipping ${symbol}: ${result.error}`);
        failCount++;
        continue;
      }

      const candles = result.candles;
      if (!candles || candles.length === 0) {
        failCount++;
        continue;
      }

      const prices = candles.map((candle: any) => candle.close);
      if (prices.length >= 40) {
        const returns = calculateLogReturns(prices);
        if (returns.length >= 30) {
          stockReturns.push({ symbol, returns });
          successCount++;
        } else {
          logger.warn(
            `Skipping ${symbol}: Only ${returns.length} returns (need at least 30)`,
          );
          failCount++;
        }
      } else {
        logger.warn(
          `Skipping ${symbol}: Only ${prices.length} candles (need at least 40)`,
        );
        failCount++;
      }
    } catch (err: any) {
      logger.warn(`Error processing ${symbol}:`, err.message);
      failCount++;
    }
  }

  logger.info(
    `Successfully fetched data for ${successCount} stocks, failed: ${failCount}`,
  );

  if (stockReturns.length < 2) {
    throw new Error(
      "Insufficient data for correlation analysis. Need at least 2 stocks with valid data.",
    );
  }

  const minLength = Math.min(...stockReturns.map((s) => s.returns.length));

  if (minLength < 30) {
    throw new Error(
      `Insufficient time points (${minLength}). Need at least 30 data points per stock.`,
    );
  }

  const alignedReturns = stockReturns.map((s) => ({
    symbol: s.symbol,
    returns: s.returns.slice(-minLength),
  }));

  logger.info(
    `Calculating correlation matrix for ${alignedReturns.length} stocks with ${minLength} time points each`,
  );

  const correlationMatrix: number[][] = [];
  const symbols = alignedReturns.map((s) => s.symbol);

  for (let i = 0; i < alignedReturns.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < alignedReturns.length; j++) {
      if (i === j) {
        row.push(1.0);
      } else {
        try {
          const corr = calculateCorrelation(
            alignedReturns[i].returns,
            alignedReturns[j].returns,
          );
          if (isNaN(corr) || !isFinite(corr)) {
            row.push(0.0);
          } else {
            row.push(Number(corr.toFixed(3)));
          }
        } catch (err: any) {
          row.push(0.0);
        }
      }
    }
    correlationMatrix.push(row);
  }

  let sumCorr = 0;
  let count = 0;
  for (let i = 0; i < correlationMatrix.length; i++) {
    for (let j = 0; j < i; j++) {
      sumCorr += Math.abs(correlationMatrix[i][j]);
      count++;
    }
  }
  const averageCorrelation = count > 0 ? sumCorr / count : 0;

  // Compute exact spectral decomposition of the empirical correlation matrix via Jacobi rotations
  const eigenvalues = calculateSymmetricEigenvalues(correlationMatrix);

  const N = correlationMatrix.length;
  const T = minLength;
  const Q = N / T;
  const lambdaMax = Math.pow(1 + Math.sqrt(Q), 2);

  const significantEigenvalues = eigenvalues.filter(
    (e) => e > lambdaMax,
  ).length;

  logger.info(
    `Correlation analysis complete: ${symbols.length} stocks, avg correlation: ${averageCorrelation.toFixed(3)}, significant factors: ${significantEigenvalues}`,
  );

  return {
    symbols,
    correlationMatrix,
    eigenvalues,
    rmtThreshold: lambdaMax,
    significantEigenvalues,
    averageCorrelation,
    timestamp: new Date().toISOString(),
  };
}

export async function processMPT(
  symbols: string[],
  timeframe: string,
  riskFreeRate: number,
) {
  const tf = timeframe || "1Y";
  const rf = riskFreeRate || 0.06;

  logger.info(`MPT optimization for ${symbols.length} stocks (${tf})`);

  const matrixResult = await fetchStockReturnsMatrix(symbols, tf);
  if ("error" in matrixResult) {
    throw new Error(matrixResult.error);
  }
  const { returnsMatrix, returnSymbols, minLength } = matrixResult;

  logger.info(
    `Sending MPT request to ML service: ${returnSymbols.length} assets, ${minLength} time periods`,
  );

  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/mpt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      returns: returnsMatrix,
      symbols: returnSymbols,
      risk_free_rate: Number(rf),
    }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      symbols: returnSymbols,
      optimal_portfolio: mlData.optimal_portfolio,
      efficient_frontier: mlData.efficient_frontier || [],
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}

export async function processBlackLitterman(
  symbols: string[],
  timeframe: string,
  riskAversion: number,
  tau: number,
) {
  const tf = timeframe || "1Y";
  const lambda = riskAversion || 3.0;
  const tauVal = tau || 0.05;

  logger.info(
    `Black-Litterman optimization for ${symbols.length} stocks (${tf})`,
  );

  const matrixResult = await fetchStockReturnsMatrix(symbols, tf);
  if ("error" in matrixResult) {
    throw new Error(matrixResult.error);
  }
  const { returnsMatrix, returnSymbols, minLength } = matrixResult;

  logger.info(
    `Sending Black-Litterman request to ML service: ${returnSymbols.length} assets, ${minLength} time periods`,
  );

  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/black-litterman`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      returns: returnsMatrix,
      symbols: returnSymbols,
      risk_aversion: Number(lambda),
      tau: Number(tauVal),
    }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      symbols: returnSymbols,
      optimal_weights: mlData.optimal_weights || [],
      expected_return: mlData.expected_return || 0,
      volatility: mlData.volatility || 0,
      sharpe_ratio: mlData.sharpe_ratio || 0,
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}

export async function processArima(
  symbol: string,
  timeframe: string,
  order: number[],
) {
  let result = await fetchAngelHistoricalCandles(symbol, timeframe);
  if (result.error) {
    throw new Error(result.error);
  }

  let candles = result.candles;
  let prices = candles.map((candle) => candle.close);

  if (prices.length < 30 && timeframe !== "1Y") {
    logger.info(`Insufficient data for ${timeframe}, trying 1Y timeframe`);
    result = await fetchAngelHistoricalCandles(symbol, "1Y");
    if (!result.error) {
      candles = result.candles;
      prices = candles.map((candle) => candle.close);
    }
  }

  if (prices.length < 30) {
    throw new Error(
      `Insufficient data for ARIMA model (need at least 30 candles, got ${prices.length}). Try selecting a longer timeframe like 1Y.`,
    );
  }

  const logReturns = calculateLogReturns(prices);
  if (logReturns.length < 20) {
    throw new Error("Insufficient returns for ARIMA model");
  }

  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/arima`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returns: logReturns, order }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      order: mlData.order,
      aic: mlData.aic,
      bic: mlData.bic,
      params: mlData.params,
      forecast: mlData.forecast,
      summary: mlData.summary,
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}

export async function processGarch(
  symbol: string,
  timeframe: string,
  order: number[],
) {
  let result = await fetchYahooFinanceData(symbol, timeframe);
  if (result.error || result.candles.length === 0) {
    result = await fetchAngelHistoricalCandles(symbol, timeframe);
  }

  if (result.error) {
    throw new Error(result.error);
  }

  let candles = result.candles;
  let prices = candles.map((candle) => candle.close);

  if (
    prices.length < 50 &&
    timeframe !== "1Y" &&
    timeframe !== "2Y" &&
    timeframe !== "3Y"
  ) {
    logger.info(`Insufficient data for ${timeframe}, trying 1Y timeframe`);
    result = await fetchYahooFinanceData(symbol, "1Y");
    if (result.error || result.candles.length === 0) {
      result = await fetchAngelHistoricalCandles(symbol, "1Y");
    }
    if (!result.error) {
      candles = result.candles;
      prices = candles.map((candle) => candle.close);
    }
  }

  if (prices.length < 50) {
    throw new Error(
      `Insufficient data for GARCH model (need at least 50 candles, got ${prices.length}). Try selecting a longer timeframe like 1Y.`,
    );
  }

  const logReturns = calculateLogReturns(prices);
  if (logReturns.length < 30) {
    throw new Error("Insufficient returns for GARCH model");
  }

  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/garch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returns: logReturns, order }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      order: mlData.order,
      aic: mlData.aic,
      bic: mlData.bic,
      params: mlData.params,
      conditionalVolatility: mlData.conditional_volatility,
      forecast: mlData.forecast,
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}

export async function processLstm(
  symbol: string,
  timeframe: string,
  lookback: number,
  forecastSteps: number,
) {
  const result = await fetchAngelHistoricalCandles(symbol, timeframe);
  if (result.error) {
    throw new Error(result.error);
  }

  const candles = result.candles;
  const prices = candles.map((candle) => candle.close);

  if (prices.length < lookback + 20) {
    throw new Error(
      "Insufficient data for LSTM model (need at least 30 data points)",
    );
  }

  const logReturns = calculateLogReturns(prices);

  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/lstm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      returns: logReturns,
      lookback,
      forecast_steps: forecastSteps,
    }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      forecast: mlData.forecast,
      rmse: mlData.rmse,
      r2_score: mlData.r2_score,
      training_loss: mlData.training_loss,
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}

export async function processFinBERT(text: string) {
  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/sentiment/finbert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      sentiment: mlData.sentiment,
      score: mlData.score,
      confidence: mlData.confidence,
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}

export async function processRuleBased(text: string) {
  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/sentiment/rule-based`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      sentiment: mlData.sentiment,
      bullish_signals: mlData.bullish_signals,
      bearish_signals: mlData.bearish_signals,
      confidence: mlData.confidence,
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}

export async function processAdfTest(symbol: string, timeframe: string) {
  const fetched = await fetchPricesAndLogReturns(symbol, timeframe);
  if ("error" in fetched) {
    throw new Error(fetched.error);
  }
  const { logReturns } = fetched;
  if (logReturns.length < 10) {
    throw new Error(
      "Insufficient data for ADF test (need at least 10 data points)",
    );
  }

  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/adf-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returns: logReturns }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      symbol,
      testStatistic: mlData.test_statistic,
      pValue: mlData.p_value,
      criticalValues: {
        "1%": mlData.critical_values["1%"],
        "5%": mlData.critical_values["5%"],
        "10%": mlData.critical_values["10%"],
      },
      isStationary: mlData.is_stationary,
      interpretation: mlData.is_stationary
        ? `Series is stationary (p-value = ${mlData.p_value.toFixed(4)} < 0.05).`
        : `Series is non-stationary (p-value = ${mlData.p_value.toFixed(4)} >= 0.05).`,
      recommendation: mlData.is_stationary
        ? "Data is stationary. You can proceed with AR/MA/ARIMA models without differencing (d=0)."
        : "Data is non-stationary. Apply differencing (d>0) before modeling with ARIMA.",
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}

export async function processAcfPacf(
  symbol: string,
  timeframe: string,
  maxLags: number,
) {
  const fetched = await fetchPricesAndLogReturns(symbol, timeframe);
  if ("error" in fetched) {
    throw new Error(fetched.error);
  }
  const { logReturns } = fetched;

  const adjustedMaxLags = Math.min(maxLags, Math.floor(logReturns.length / 2));

  if (logReturns.length < 5) {
    throw new Error(
      "Insufficient data for ACF/PACF calculation (need at least 5 data points)",
    );
  }

  const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/acf-pacf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      returns: logReturns,
      max_lags: adjustedMaxLags,
    }),
  });

  if (mlResp.ok) {
    const mlData: any = await mlResp.json();
    return {
      symbol,
      lags: mlData.lags,
      acf: mlData.acf,
      pacf: mlData.pacf,
      confidenceInterval: mlData.confidence_interval,
    };
  } else {
    const errorText = await mlResp.text();
    throw new Error(errorText || "ML service error");
  }
}
