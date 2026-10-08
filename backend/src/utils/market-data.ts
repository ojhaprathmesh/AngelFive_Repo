import { ENV } from "../config/env";
import { logger } from "../lib/logger";
import { getSmartApiJwtToken } from "../lib/smartapi";

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export interface InstrumentEntry {
  token: string | number;
  symbol?: string;
  name?: string;
  tradingSymbol?: string;
  instrumentType?: string;
  exchangeSeg?: string;
  tradingsymbol?: string;
  instrumenttype?: string;
  exch_seg?: string;
}

export interface SmartAPICandleResponse {
  status: boolean;
  message: string;
  errorCode: string;
  data?: Array<[string, number, number, number, number, number]>;
}

import { resolveSymbolToToken } from "./instrument-master";

const smartAPIkey = ENV.SMARTAPI_API_KEY;
const localIp = ENV.SMARTAPI_LOCAL_IP;
const publicIp = ENV.SMARTAPI_PUBLIC_IP;
const mac = ENV.SMARTAPI_MAC_ADDRESS;

export async function getSymbolToken(
  symbol: string,
  exchange: string = "NSE",
): Promise<{ token: string; exchange: string } | null> {
  const match = await resolveSymbolToToken(symbol, exchange);
  if (match && match.token) {
    return { token: match.token, exchange: match.exchange };
  }
  logger.warn(`Symbol token not found for ${symbol} on ${exchange}`);
  return null;
}

const timeframeMap = {
  "1W": { interval: "FIFTEEN_MINUTE", days: 7 },
  "1M": { interval: "ONE_DAY", days: 30 },
  "3M": { interval: "ONE_DAY", days: 90 },
  "1Y": { interval: "ONE_DAY", days: 365 },
} as const;

function getTimeframeConfig(timeframe: string) {
  return (
    timeframeMap[timeframe as keyof typeof timeframeMap] ?? timeframeMap["1M"]
  );
}

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function fetchYahooFinanceData(
  symbol: string,
  timeframe: string,
): Promise<{ candles: Candle[]; error?: string }> {
  try {
    const yahooSymbol = symbol.toUpperCase().replace("-EQ", "") + ".NS";
    const now = new Date();
    let fromDate = new Date();

    switch (timeframe) {
      case "1W":
        fromDate.setDate(now.getDate() - 7);
        break;
      case "1M":
        fromDate.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        fromDate.setMonth(now.getMonth() - 3);
        break;
      case "6M":
        fromDate.setMonth(now.getMonth() - 6);
        break;
      case "1Y":
        fromDate.setFullYear(now.getFullYear() - 1);
        break;
      case "2Y":
        fromDate.setFullYear(now.getFullYear() - 2);
        break;
      case "3Y":
        fromDate.setFullYear(now.getFullYear() - 3);
        break;
      case "5Y":
        fromDate.setFullYear(now.getFullYear() - 5);
        break;
      case "MAX":
        fromDate.setFullYear(now.getFullYear() - 20);
        break;
      default:
        fromDate.setFullYear(now.getFullYear() - 1);
    }

    const period1 = Math.floor(fromDate.getTime() / 1000);
    const period2 = Math.floor(now.getTime() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return {
        candles: [],
        error: `Yahoo Finance API error: ${response.status} ${response.statusText}`,
      };
    }

    const data: any = await response.json();

    if (
      !data.chart?.result?.[0]?.timestamp ||
      !data.chart?.result?.[0]?.indicators?.quote?.[0]
    ) {
      return { candles: [], error: "Invalid response from Yahoo Finance" };
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000);
      const timeStr = date.toISOString().replace("T", " ").substring(0, 19);

      const close = quote.close[i];
      const open = quote.open[i];
      const high = quote.high[i];
      const low = quote.low[i];

      if (!close || close === 0) continue;

      candles.push({
        time: timeStr,
        open: open || close,
        high: high || close,
        low: low || close,
        close: close,
        volume: quote.volume[i] || 0,
      });
    }

    if (candles.length > 0) {
      const firstDate = new Date(candles[0].time);
      const lastDate = new Date(candles[candles.length - 1].time);
      logger.info(
        `Yahoo Finance: Fetched ${candles.length} candles for ${yahooSymbol} (${timeframe})`,
      );
      logger.info(
        `  Date range: ${firstDate.toISOString().split("T")[0]} to ${lastDate.toISOString().split("T")[0]}`,
      );
    }

    return { candles };
  } catch (e: any) {
    logger.error({ err: e }, "Yahoo Finance fetch error:");
    return {
      candles: [],
      error: e.message || "Failed to fetch from Yahoo Finance",
    };
  }
}

export async function fetchAngelHistoricalCandles(
  symbol: string,
  timeframe: string,
): Promise<{ candles: Candle[]; error?: string }> {
  const tokenInfo = await getSymbolToken(symbol);
  if (!tokenInfo) {
    return {
      candles: [],
      error: `Symbol "${symbol}" not found in instrument master. Try using the exact symbol from Angel One (e.g., "RELIANCE-EQ" instead of "RELIANCE")`,
    };
  }

  if (!smartAPIkey) {
    const errorMsg =
      "SmartAPI API key missing. Please set SMARTAPI_API_KEY in your .env file.";
    logger.error(errorMsg);
    return { candles: [], error: errorMsg };
  }

  const jwt = await getSmartApiJwtToken();
  if (!jwt) {
    const errorMsg =
      "Failed to generate SmartAPI JWT token. Please check SMARTAPI_CLIENT_CODE, SMARTAPI_PASSWORD, and SMARTAPI_TOTP_SECRET in your .env file.";
    logger.error(errorMsg);
    return { candles: [], error: errorMsg };
  }

  const { interval, days } = getTimeframeConfig(timeframe);
  const now = new Date();
  const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const body = {
    exchange: tokenInfo.exchange,
    symboltoken: tokenInfo.token,
    interval,
    fromdate: formatDateTime(fromDate),
    todate: formatDateTime(now),
  };

  try {
    const resp = await fetch(
      "https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PrivateKey": smartAPIkey,
          "X-SourceID": "WEB",
          "X-ClientLocalIP": localIp || "127.0.0.1",
          "X-ClientPublicIP": publicIp || "127.0.0.1",
          "X-MACAddress": mac || "00:00:00:00:00:00",
          "X-UserType": "USER",
          Authorization: `Bearer ${jwt}`,
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      let errorMsg = `Angel One API error (${resp.status}): ${resp.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.message || errorJson.error || errorMsg;
      } catch {
        if (errorText) errorMsg = errorText;
      }
      logger.error({ err: errorMsg }, `Angel historical API error:`);
      return { candles: [], error: errorMsg };
    }

    const json = (await resp.json()) as SmartAPICandleResponse;
    if (!json.status || !Array.isArray(json.data)) {
      const errorMsg = json.message || "Invalid response from Angel One API";
      logger.error({ err: json }, "Invalid Angel historical response");
      return { candles: [], error: errorMsg };
    }

    const validCandles: Candle[] = [];
    let invalidCount = 0;

    for (const [time, open, high, low, close, volume] of json.data) {
      let dateObj: Date | null = null;

      if (
        time.trim() === "" ||
        time === "0" ||
        time === "null" ||
        time === "undefined"
      ) {
        invalidCount++;
        continue;
      }
      dateObj = new Date(time);
      if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 2000) {
        const timestampSec = parseInt(time, 10);
        if (!isNaN(timestampSec) && timestampSec > 946684800) {
          dateObj = new Date(timestampSec * 1000);
        } else {
          const timestampMs = parseInt(time, 10);
          if (!isNaN(timestampMs) && timestampMs > 946684800000) {
            dateObj = new Date(timestampMs);
          } else {
            const dateMatch = time.match(
              /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
            );
            if (dateMatch) {
              const [, year, month, day, hour, minute, second] = dateMatch;
              dateObj = new Date(
                parseInt(year, 10),
                parseInt(month, 10) - 1,
                parseInt(day, 10),
                parseInt(hour, 10),
                parseInt(minute, 10),
                parseInt(second, 10),
              );
            } else {
              invalidCount++;
              continue;
            }
          }
        }
      }

      if (
        !dateObj ||
        isNaN(dateObj.getTime()) ||
        dateObj.getFullYear() < 2000
      ) {
        invalidCount++;
        continue;
      }

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const minutes = String(dateObj.getMinutes()).padStart(2, "0");
      const seconds = String(dateObj.getSeconds()).padStart(2, "0");
      const parsedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      const c = Number(close) || 0;
      if (c === 0) continue;

      validCandles.push({
        time: parsedTime,
        open: Number(open) || c,
        high: Number(high) || c,
        low: Number(low) || c,
        close: c,
        volume: Number(volume) || 0,
      });
    }

    if (validCandles.length === 0) {
      return {
        candles: [],
        error: "No valid historical data found. All timestamps were invalid.",
      };
    }

    const candles = validCandles.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    return { candles };
  } catch (e: any) {
    const errorMsg =
      e.message || "Network error while fetching data from Angel One API";
    logger.error({ err: e }, "Error fetching Angel historical data:");
    return { candles: [], error: errorMsg };
  }
}

export function calculateLogReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      const ret = Math.log(prices[i] / prices[i - 1]);
      if (isFinite(ret)) {
        returns.push(ret);
      }
    }
  }
  return returns;
}

export async function fetchPricesAndLogReturns(
  symbol: string,
  timeframe: string,
): Promise<
  | { prices: number[]; logReturns: number[]; candles: any[] }
  | { error: string; status: number }
> {
  let result = await fetchYahooFinanceData(symbol, timeframe);
  if (result.error || result.candles.length === 0) {
    result = await fetchAngelHistoricalCandles(symbol, timeframe);
  }
  if (result.error) {
    return { error: result.error, status: 404 };
  }
  const candles = result.candles;
  const prices = candles.map((candle) => candle.close);
  if (prices.length === 0) {
    return { error: `No data found for ${symbol}`, status: 404 };
  }
  const logReturns = calculateLogReturns(prices);
  return { prices, logReturns, candles };
}

export async function fetchStockReturnsMatrix(
  symbols: string[],
  timeframe: string,
  minPrices = 30,
  minReturns = 20,
): Promise<
  | { error: string }
  | {
      returnsMatrix: number[][];
      returnSymbols: string[];
      minLength: number;
    }
> {
  const stockReturns: { symbol: string; returns: number[] }[] = [];

  for (const symbol of symbols) {
    try {
      let result = await fetchYahooFinanceData(symbol, timeframe);
      if (result.error || result.candles.length === 0) {
        result = await fetchAngelHistoricalCandles(symbol, timeframe);
      }

      if (result.error) {
        logger.warn(`Skipping ${symbol}: ${result.error}`);
        continue;
      }

      const candles = result.candles;
      if (!candles || candles.length === 0) continue;

      const prices = candles.map((candle: Candle) => candle.close);
      if (prices.length >= minPrices) {
        const returns = calculateLogReturns(prices);
        if (returns.length >= minReturns) {
          stockReturns.push({ symbol, returns });
        }
      }
    } catch (err: any) {
      logger.warn(`Error processing ${symbol}:`, err.message);
    }
  }

  if (stockReturns.length < 2) {
    return {
      error:
        "Insufficient data. Need at least 2 stocks with valid historical data.",
    };
  }

  const minLength = Math.min(...stockReturns.map((s) => s.returns.length));
  const alignedReturns = stockReturns.map((s) => ({
    symbol: s.symbol,
    returns: s.returns.slice(-minLength),
  }));

  const returnsMatrix: number[][] = alignedReturns.map((s) =>
    s.returns.map((r) => {
      if (r === null || r === undefined || !isFinite(r) || isNaN(r)) {
        return 0;
      }
      return r;
    }),
  );
  const returnSymbols = alignedReturns.map((s) => s.symbol);

  return { returnsMatrix, returnSymbols, minLength };
}

export function calculateStatistics(returns: number[]) {
  if (returns.length === 0) {
    return {
      mean: 0,
      std: 0,
      skewness: 0,
      kurtosis: 0,
      min: 0,
      max: 0,
    };
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);

  const skewness =
    returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 3), 0) /
    returns.length;

  const kurtosis =
    returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 4), 0) /
      returns.length -
    3;

  const min = Math.min(...returns);
  const max = Math.max(...returns);

  return { mean, std, skewness, kurtosis, min, max };
}

export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    sumSqX += diffX * diffX;
    sumSqY += diffY * diffY;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Computes exact real eigenvalues for a real symmetric square matrix (e.g. Correlation/Covariance)
 * using the Jacobi eigenvalue algorithm with cyclic orthogonal rotations.
 *
 * @param matrix Real symmetric square matrix NxN
 * @param maxIterations Maximum Jacobi sweeps (default 100)
 * @param tolerance Convergence threshold for off-diagonal magnitudes
 * @returns Sorted eigenvalues in descending order
 */
export function calculateSymmetricEigenvalues(
  matrix: number[][],
  maxIterations = 100,
  tolerance = 1e-9,
): number[] {
  const n = matrix.length;
  if (n === 0) return [];
  if (n === 1) return [matrix[0][0]];

  // Clone matrix to avoid in-place mutation
  const A: number[][] = matrix.map((row) => [...row]);

  for (let iter = 0; iter < maxIterations; iter++) {
    let maxOffDiag = 0;
    let p = 0;
    let q = 1;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const val = Math.abs(A[i][j]);
        if (val > maxOffDiag) {
          maxOffDiag = val;
          p = i;
          q = j;
        }
      }
    }

    if (maxOffDiag < tolerance) {
      break; // Matrix is successfully diagonalized
    }

    const diff = A[q][q] - A[p][p];
    let t: number;
    if (Math.abs(A[p][q]) < Math.abs(diff) * 1e-15) {
      t = A[p][q] / diff;
    } else {
      const phi = diff / (2 * A[p][q]);
      t = 1 / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
      if (phi < 0) t = -t;
    }

    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;
    const tau = s / (1 + c);

    const App = A[p][p];
    const Aqq = A[q][q];
    const Apq = A[p][q];

    A[p][p] = App - t * Apq;
    A[q][q] = Aqq + t * Apq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const Aip = A[i][p];
        const Aiq = A[i][q];
        A[i][p] = Aip - s * (Aiq + tau * Aip);
        A[p][i] = A[i][p];
        A[i][q] = Aiq + s * (Aip - tau * Aiq);
        A[q][i] = A[i][q];
      }
    }
  }

  const eigenvalues: number[] = [];
  for (let i = 0; i < n; i++) {
    eigenvalues.push(Number(A[i][i].toFixed(4)));
  }

  return eigenvalues.sort((a, b) => b - a);
}
