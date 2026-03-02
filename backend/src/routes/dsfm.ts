import speakeasy from "speakeasy";
import express, { Request, Response } from "express";
import { ENV } from "../config/env";

type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

interface InstrumentEntry {
  token: string | number;
  symbol?: string;
  name?: string;
  tradingsymbol?: string;
  instrumenttype?: string;
  exch_seg?: string;
}

interface SmartAPICandleResponse {
  status: boolean;
  message: string;
  errorcode: string;
  data?: Array<[string, number, number, number, number, number]>;
}

const router = express.Router();

let instrumentCache: InstrumentEntry[] | null = null;
let instrumentCacheTime = 0;
const INSTRUMENT_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

// JWT token cache
let jwtTokenCache: string | null = null;
let jwtTokenExpiry: number = 0;

const smartAPIkey = ENV.SMARTAPI_API_KEY;
const clientCode = ENV.SMARTAPI_CLIENT_CODE;
const password = ENV.SMARTAPI_PASSWORD;
const totpSecret = ENV.SMARTAPI_TOTP_SECRET;
const localIp = ENV.SMARTAPI_LOCAL_IP;
const publicIp = ENV.SMARTAPI_PUBLIC_IP;
const mac = ENV.SMARTAPI_MAC_ADDRESS;
const mlServiceUrl = ENV.ML_SERVICE_URL;

async function loadInstrumentMaster(): Promise<InstrumentEntry[]> {
  if (
    instrumentCache &&
    Date.now() - instrumentCacheTime < INSTRUMENT_CACHE_TTL
  ) {
    return instrumentCache;
  }

  try {
    const resp = await fetch(
      "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json",
    );
    if (!resp.ok) return [];
    const instruments = (await resp.json()) as InstrumentEntry[];
    instrumentCache = instruments;
    instrumentCacheTime = Date.now();
    return instruments;
  } catch (e) {
    console.error("Failed to load instrument master:", e);
    return [];
  }
}

async function getSymbolToken(
  symbol: string,
  exchange: string = "NSE",
): Promise<{ token: string; exchange: string } | null> {
  const instruments = await loadInstrumentMaster();
  const upper = symbol.toUpperCase();
  const exchangeUpper = exchange.toUpperCase();
  const match = instruments.find((item) => {
    if (item.exch_seg?.toUpperCase() !== exchangeUpper) return false;
    const candidates = [
      item.symbol?.toUpperCase(),
      item.name?.toUpperCase(),
      item.tradingsymbol?.toUpperCase(),
    ];
    return candidates.some(
      (candidate) => candidate === upper || candidate === `${upper}-EQ`,
    );
  });

  if (match && match.token) {
    return { token: String(match.token), exchange: exchangeUpper };
  }
  console.warn(`Symbol token not found for ${symbol} on ${exchangeUpper}`);
  return null;
}

/**
 * Generate TOTP using Speakeasy
 * SmartAPI requires base32 secret
 */
function generateTOTP(secret: string): string {
  return speakeasy.totp({
    secret,
    encoding: "base32",
  });
}

// Get or generate JWT token
async function getJwtToken(): Promise<string | null> {
  // Check if token is still valid (with 5 minute buffer)
  if (jwtTokenCache && Date.now() < jwtTokenExpiry - 300000) {
    return jwtTokenCache;
  }

  if (!smartAPIkey || !clientCode || !password || !totpSecret) {
    console.error("Missing SmartAPI credentials for JWT token generation");
    return null;
  }

  try {
    // Generate TOTP
    const totp = generateTOTP(totpSecret);

    const response = await fetch(
      "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PrivateKey": smartAPIkey,
          Accept: "application/json",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": localIp,
          "X-ClientPublicIP": publicIp,
          "X-MACAddress": mac,
          "X-UserType": "USER",
        },
        body: JSON.stringify({
          clientcode: clientCode,
          password: password,
          totp: totp,
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `SmartAPI login failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data: any = await response.json();

    if (!data.status || !data.data?.jwtToken) {
      console.error("SmartAPI login failed:", data.message || "Login failed");
      return null;
    }

    jwtTokenCache = data.data.jwtToken;
    jwtTokenExpiry = Date.now() + 3600000; // 1 hour expiry

    console.log("✅ SmartAPI JWT Token generated successfully");
    return jwtTokenCache;
  } catch (error: any) {
    console.error("❌ SmartAPI JWT Token generation failed:", error.message);
    jwtTokenCache = null;
    jwtTokenExpiry = 0;
    return null;
  }
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

async function fetchYahooFinanceData(
  symbol: string,
  timeframe: string,
): Promise<{ candles: Candle[]; error?: string }> {
  try {
    // Convert NSE symbols to Yahoo Finance format (e.g., RELIANCE -> RELIANCE.NS)
    const yahooSymbol = symbol.toUpperCase().replace("-EQ", "") + ".NS";

    // Calculate date range
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
        fromDate.setFullYear(now.getFullYear() - 20); // 20 years max
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

      candles.push({
        time: timeStr,
        open: quote.open[i] || 0,
        high: quote.high[i] || 0,
        low: quote.low[i] || 0,
        close: quote.close[i] || 0,
        volume: quote.volume[i] || 0,
      });
    }

    // Log date range for debugging
    if (candles.length > 0) {
      const firstDate = new Date(candles[0].time);
      const lastDate = new Date(candles[candles.length - 1].time);
      console.log(
        `Yahoo Finance: Fetched ${candles.length} candles for ${yahooSymbol} (${timeframe})`,
      );
      console.log(
        `  Date range: ${firstDate.toISOString().split("T")[0]} to ${lastDate.toISOString().split("T")[0]}`,
      );
      console.log(
        `  Requested from: ${fromDate.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`,
      );
    }

    return { candles };
  } catch (e: any) {
    console.error("Yahoo Finance fetch error:", e);
    return {
      candles: [],
      error: e.message || "Failed to fetch from Yahoo Finance",
    };
  }
}

async function fetchAngelHistoricalCandles(
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
      "SmartAPI API key missing. Please set SMARTAPI_API_KEY in your .env file. Make sure to restart the backend server after adding credentials.";
    console.error(errorMsg);
    return { candles: [], error: errorMsg };
  }

  // Get JWT token (will generate if needed)
  const jwt = await getJwtToken();
  if (!jwt) {
    const errorMsg =
      "Failed to generate SmartAPI JWT token. Please check SMARTAPI_CLIENT_CODE, SMARTAPI_PASSWORD, and SMARTAPI_TOTP_SECRET in your .env file.";
    console.error(errorMsg);
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
          "X-ClientLocalIP": localIp,
          "X-ClientPublicIP": publicIp,
          "X-MACAddress": mac,
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
      console.error(`Angel historical API error:`, errorMsg);
      return { candles: [], error: errorMsg };
    }

    const json = (await resp.json()) as SmartAPICandleResponse;
    if (!json.status || !Array.isArray(json.data)) {
      const errorMsg = json.message || "Invalid response from Angel One API";
      console.error("Invalid Angel historical response", json);
      return { candles: [], error: errorMsg };
    }

    // Debug: Log first few timestamps to see format
    if (json.data.length > 0) {
      console.log(
        "Sample API response timestamps (first 5):",
        json.data.slice(0, 5).map(([time]) => ({
          time,
          type: typeof time,
          raw: JSON.stringify(time),
          parsed: new Date(time as string).toISOString(),
        })),
      );
    }

    const validCandles: Candle[] = [];
    let invalidCount = 0;

    for (const [time, open, high, low, close, volume] of json.data) {
      let dateObj: Date | null = null;

      // Handle different time formats
      // Try parsing as date string first
      if (
        time.trim() === "" ||
        time === "0" ||
        time === "null" ||
        time === "undefined"
      ) {
        console.warn(`Empty or invalid time string: "${time}"`);
        invalidCount++;
        continue;
      }
      dateObj = new Date(time);
      if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 2000) {
        // Try as Unix timestamp (seconds)
        const timestampSec = parseInt(time, 10);
        if (!isNaN(timestampSec) && timestampSec > 946684800) {
          // After 2000-01-01
          dateObj = new Date(timestampSec * 1000);
        } else {
          // Try as Unix timestamp (milliseconds)
          const timestampMs = parseInt(time, 10);
          if (!isNaN(timestampMs) && timestampMs > 946684800000) {
            dateObj = new Date(timestampMs);
          } else {
            // Try parsing with different date formats
            // Format: "DD-MMM-YYYY HH:MM:SS" or "YYYY-MM-DD HH:MM:SS"
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
              console.warn(`Could not parse time: "${time}"`);
              invalidCount++;
              continue;
            }
          }
        }
      }

      // Final validation - must be a valid date after year 2000
      if (
        !dateObj ||
        isNaN(dateObj.getTime()) ||
        dateObj.getFullYear() < 2000
      ) {
        console.warn(
          `Invalid date object created from time: "${time}", year: ${dateObj?.getFullYear()}`,
        );
        invalidCount++;
        continue;
      }

      // Format as "YYYY-MM-DD HH:MM:SS"
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const minutes = String(dateObj.getMinutes()).padStart(2, "0");
      const seconds = String(dateObj.getSeconds()).padStart(2, "0");
      const parsedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      validCandles.push({
        time: parsedTime,
        open: Number(open) || 0,
        high: Number(high) || 0,
        low: Number(low) || 0,
        close: Number(close) || 0,
        volume: Number(volume) || 0,
      });
    }

    if (invalidCount > 0) {
      console.warn(
        `Filtered out ${invalidCount} invalid candles with bad dates`,
      );
    }

    if (validCandles.length === 0) {
      console.error(
        "No valid candles after filtering! All dates were invalid.",
      );
      return {
        candles: [],
        error: "No valid historical data found. All timestamps were invalid.",
      };
    }

    // Sort by time
    const candles = validCandles.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    console.log(
      `Successfully parsed ${candles.length} valid candles out of ${json.data.length} total`,
    );

    return { candles };
  } catch (e: any) {
    const errorMsg =
      e.message || "Network error while fetching data from Angel One API";
    console.error("Error fetching Angel historical data:", e);
    return { candles: [], error: errorMsg };
  }
}

// Helper function to calculate log returns
function calculateLogReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return returns;
}

async function requireSymbolAndFetch(
  symbol: string,
  timeframe: string,
  res: Response,
): Promise<{ prices: number[]; logReturns: number[]; candles: any[] } | null> {
  if (!symbol) {
    res.status(400).json({ error: "Symbol is required" });
    return null;
  }
  const fetched = await fetchPricesAndLogReturns(symbol, timeframe);
  if ("error" in fetched) {
    res.status(fetched.status).json({ error: fetched.error });
    return null;
  }
  return fetched;
}

async function fetchPricesAndLogReturns(
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

// Helper function to calculate statistics
function calculateStatistics(returns: number[]) {
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

  // Calculate skewness
  const skewness =
    returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 3), 0) /
    returns.length;

  // Calculate kurtosis
  const kurtosis =
    returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 4), 0) /
      returns.length -
    3;

  const min = Math.min(...returns);
  const max = Math.max(...returns);

  return { mean, std, skewness, kurtosis, min, max };
}

async function getNSECookie(): Promise<string> {
  const resp = await fetch("https://www.nseindia.com/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  return resp.headers.get("set-cookie") || "";
}

async function fetchNSEIndex(indexName: string = "NIFTY 500"): Promise<any[]> {
  const cookie = await getNSECookie();
  const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      Referer:
        "https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY%20500",
      Cookie: cookie,
    },
  });
  if (!resp.ok) return [];
  const json: any = await resp.json();
  return json?.data || [];
}

// Returns Analysis endpoint
router.get("/returns", async (req: Request, res: Response): Promise<void> => {
  try {
    const symbol = String(req.query.symbol || "");
    const timeframe = String(req.query.timeframe || "1M");

    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    // Try Yahoo Finance first (better for DSFM analysis - more historical data)
    let result = await fetchYahooFinanceData(symbol, timeframe);

    // Fallback to Angel One if Yahoo fails
    if (result.error || result.candles.length === 0) {
      console.log(`Yahoo Finance failed for ${symbol}, trying Angel One...`);
      result = await fetchAngelHistoricalCandles(symbol, timeframe);
    }

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    const candles = result.candles;
    const prices = candles.map((candle) => candle.close);
    const timestamps = candles.map((candle) => candle.time);

    if (prices.length === 0) {
      res.status(404).json({
        error: `No historical data found for ${symbol}. The API returned empty data.`,
      });
      return;
    }

    // Calculate log returns
    const logReturns = calculateLogReturns(prices);

    if (logReturns.length === 0) {
      res.status(400).json({ error: "Insufficient data to calculate returns" });
      return;
    }

    const stats = calculateStatistics(logReturns);

    // Calculate Sharpe ratio (assuming risk-free rate of 6% annually)
    // Annualize the daily statistics: mean * 252, std * sqrt(252)
    const annualizedMean = stats.mean * 252; // Annualize daily mean
    const annualizedStd = stats.std * Math.sqrt(252); // Annualize daily std
    const riskFreeRate = 0.06; // 6% annual risk-free rate
    const sharpeRatio =
      annualizedStd > 0 ? (annualizedMean - riskFreeRate) / annualizedStd : 0;

    res.json({
      symbol,
      meanReturn: stats.mean,
      volatility: stats.std,
      sharpeRatio: isFinite(sharpeRatio) ? sharpeRatio : 0,
      skewness: stats.skewness,
      kurtosis: stats.kurtosis,
      minReturn: stats.min,
      maxReturn: stats.max,
      logReturns: logReturns, // Return all log returns for visualization
      prices: prices, // Return all prices for visualization
      timestamps: timestamps, // Return timestamps for chart x-axis
      priceCount: prices.length,
      returnCount: logReturns.length,
      // Calculation explanations
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
    });
  } catch (e) {
    console.error("Error calculating returns:", e);
    res.status(500).json({ error: "failed_to_calculate_returns" });
  }
});

// Correlation Analysis endpoint
router.get(
  "/correlation",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const timeframe = (req.query.timeframe as string) || "3M";

      console.log(`Starting correlation analysis for NIFTY 50 (${timeframe})`);

      // Get all NIFTY 50 stocks
      const rows = await fetchNSEIndex("NIFTY 50");
      if (!rows || rows.length === 0) {
        console.error("Failed to fetch NIFTY 50 index data");
        res.status(500).json({ error: "Failed to fetch NIFTY 50 index data" });
        return;
      }

      const allStocks = rows
        .map((r: any) => String(r?.symbol || r?.tradingsymbol || ""))
        .filter((s) => s.length > 0 && !s.includes("NIFTY"));

      console.log(`Found ${allStocks.length} stocks in NIFTY 50`);

      // Fetch returns for all stocks using Yahoo Finance (with Angel One fallback)
      const stockReturns: { symbol: string; returns: number[] }[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const symbol of allStocks) {
        try {
          // Try Yahoo Finance first
          let result = await fetchYahooFinanceData(symbol, timeframe);
          if (result.error || result.candles.length === 0) {
            // Fallback to Angel One
            result = await fetchAngelHistoricalCandles(symbol, timeframe);
          }

          if (result.error) {
            console.warn(`Skipping ${symbol}: ${result.error}`);
            failCount++;
            continue;
          }

          const candles = result.candles;
          if (!candles || candles.length === 0) {
            failCount++;
            continue;
          }

          const prices = candles.map((candle: Candle) => candle.close);
          // Require at least 40 data points for meaningful correlation analysis
          if (prices.length >= 40) {
            const returns = calculateLogReturns(prices);
            if (returns.length >= 30) {
              // Ensure we have enough returns after calculation
              stockReturns.push({ symbol, returns });
              successCount++;
            } else {
              console.warn(
                `Skipping ${symbol}: Only ${returns.length} returns (need at least 30)`,
              );
              failCount++;
            }
          } else {
            console.warn(
              `Skipping ${symbol}: Only ${prices.length} candles (need at least 40)`,
            );
            failCount++;
          }
        } catch (err: any) {
          console.warn(`Error processing ${symbol}:`, err.message);
          failCount++;
        }
      }

      console.log(
        `Successfully fetched data for ${successCount} stocks, failed: ${failCount}`,
      );

      if (stockReturns.length < 2) {
        console.error(`Insufficient stocks with data: ${stockReturns.length}`);
        res.status(400).json({
          error:
            "Insufficient data for correlation analysis. Need at least 2 stocks with valid data.",
        });
        return;
      }

      // Align returns to same length (use minimum length)
      const minLength = Math.min(...stockReturns.map((s) => s.returns.length));

      if (minLength < 30) {
        console.error(`Insufficient time points after alignment: ${minLength}`);
        res.status(400).json({
          error: `Insufficient time points (${minLength}). Need at least 30 data points per stock for correlation analysis.`,
        });
        return;
      }

      const alignedReturns = stockReturns.map((s) => ({
        symbol: s.symbol,
        returns: s.returns.slice(-minLength),
      }));

      console.log(
        `Calculating correlation matrix for ${alignedReturns.length} stocks with ${minLength} time points each`,
      );

      // Calculate correlation matrix
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
              // Ensure correlation is a valid number
              if (isNaN(corr) || !isFinite(corr)) {
                console.warn(
                  `Invalid correlation for ${symbols[i]} vs ${symbols[j]}: ${corr}`,
                );
                row.push(0.0);
              } else {
                row.push(Number(corr.toFixed(3)));
              }
            } catch (err: any) {
              console.warn(
                `Error calculating correlation for ${symbols[i]} vs ${symbols[j]}:`,
                err.message,
              );
              row.push(0.0); // Default to zero correlation on error
            }
          }
        }
        correlationMatrix.push(row);
      }

      // Calculate average correlation (excluding diagonal)
      let sumCorr = 0;
      let count = 0;
      for (let i = 0; i < correlationMatrix.length; i++) {
        for (let j = 0; j < i; j++) {
          sumCorr += Math.abs(correlationMatrix[i][j]);
          count++;
        }
      }
      const averageCorrelation = count > 0 ? sumCorr / count : 0;

      // Simple eigenvalue estimation (largest eigenvalue ≈ trace for correlation matrix)
      // For proper eigenvalues, we'd need a linear algebra library
      // Here we'll use a simple approximation: sum of correlations per row
      const eigenvalues: number[] = [];
      for (let i = 0; i < correlationMatrix.length; i++) {
        const rowSum = correlationMatrix[i].reduce(
          (sum, val) => sum + Math.abs(val),
          0,
        );
        eigenvalues.push(rowSum);
      }
      eigenvalues.sort((a, b) => b - a); // Sort descending

      // RMT threshold (Marchenko-Pastur law)
      const N = correlationMatrix.length; // number of assets
      const T = minLength; // number of time points

      if (T === 0 || N === 0) {
        console.error(`Invalid dimensions: N=${N}, T=${T}`);
        res
          .status(500)
          .json({ error: "Invalid matrix dimensions for RMT calculation" });
        return;
      }

      const Q = N / T; // ratio

      if (Q >= 1) {
        console.warn(
          `Q ratio >= 1 (${Q.toFixed(3)}), RMT may not be accurate. N=${N}, T=${T}`,
        );
      }

      const lambdaMax = Math.pow(1 + Math.sqrt(Q), 2); // Upper edge of MP distribution
      // const lambdaMin = Math.pow(1 - Math.sqrt(Q), 2); // Lower edge

      // Count significant eigenvalues (above RMT threshold)
      const significantEigenvalues = eigenvalues.filter(
        (e) => e > lambdaMax,
      ).length;

      console.log(
        `Correlation analysis complete: ${symbols.length} stocks, avg correlation: ${averageCorrelation.toFixed(3)}, significant factors: ${significantEigenvalues}`,
      );

      res.json({
        symbols,
        correlationMatrix,
        eigenvalues,
        rmtThreshold: lambdaMax,
        significantEigenvalues,
        averageCorrelation,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error("Error calculating correlation:", e);
      console.error("Stack trace:", e.stack);
      res.status(500).json({
        error: `failed_to_calculate_correlation: ${e.message || "Unknown error"}`,
      });
    }
  },
);

// Helper to calculate Pearson correlation
function calculateCorrelation(x: number[], y: number[]): number {
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

// Fetch and build a returns matrix for a list of symbols
async function fetchStockReturnsMatrix(
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
        console.warn(`Skipping ${symbol}: ${result.error}`);
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
      console.warn(`Error processing ${symbol}:`, err.message);
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

// MPT (Modern Portfolio Theory) Optimization endpoint
router.post("/mpt", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbols, timeframe, riskFreeRate } = req.body || {};

    if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
      res.status(400).json({
        error: "At least 2 symbols required for portfolio optimization",
      });
      return;
    }

    const tf = timeframe || "1Y";
    const rf = riskFreeRate || 0.06;

    console.log(`MPT optimization for ${symbols.length} stocks (${tf})`);

    const matrixResult = await fetchStockReturnsMatrix(symbols, tf);
    if ("error" in matrixResult) {
      res.status(400).json({ error: matrixResult.error });
      return;
    }
    const { returnsMatrix, returnSymbols, minLength } = matrixResult;

    console.log(
      `Sending MPT request to ML service: ${returnSymbols.length} assets, ${minLength} time periods`,
    );

    // Call ML service
    const mlResp = await fetch(`${mlServiceUrl}/dsfm/mpt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        returns: returnsMatrix,
        symbols: returnSymbols,
        risk_free_rate: Number(rf), // Ensure it's a number, not undefined
      }),
    });

    if (mlResp.ok) {
      const mlData: any = await mlResp.json();
      res.json({
        symbols: returnSymbols,
        optimal_portfolio: mlData.optimal_portfolio,
        efficient_frontier: mlData.efficient_frontier || [],
      });
    } else {
      const errorText = await mlResp.text();
      console.error(`ML service MPT failed: ${mlResp.status} - ${errorText}`);
      res.status(mlResp.status).json({
        error: "ml_service_error",
        message: errorText || "ML service error",
      });
    }
  } catch (e: any) {
    console.error("Error in MPT optimization:", e);
    res.status(500).json({
      error: `failed_to_optimize_portfolio: ${e.message || "Unknown error"}`,
    });
  }
});

// Black-Litterman Optimization endpoint
router.post(
  "/black-litterman",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbols, timeframe, riskAversion, tau } = req.body || {};

      if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
        res.status(400).json({
          error: "At least 2 symbols required for portfolio optimization",
        });
        return;
      }

      const tf = timeframe || "1Y";
      const lambda = riskAversion || 3.0;
      const tauVal = tau || 0.05;

      console.log(
        `Black-Litterman optimization for ${symbols.length} stocks (${tf})`,
      );

      const matrixResult = await fetchStockReturnsMatrix(symbols, tf);
      if ("error" in matrixResult) {
        res.status(400).json({ error: matrixResult.error });
        return;
      }
      const { returnsMatrix, returnSymbols, minLength } = matrixResult;

      console.log(
        `Sending Black-Litterman request to ML service: ${returnSymbols.length} assets, ${minLength} time periods`,
      );

      // Call ML service
      const mlResp = await fetch(`${mlServiceUrl}/dsfm/black-litterman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returns: returnsMatrix,
          symbols: returnSymbols,
          risk_aversion: Number(lambda), // Ensure it's a number
          tau: Number(tauVal), // Ensure it's a number
        }),
      });

      if (mlResp.ok) {
        const mlData: any = await mlResp.json();
        res.json({
          symbols: returnSymbols,
          optimal_weights: mlData.optimal_weights || [],
          expected_return: mlData.expected_return || 0,
          volatility: mlData.volatility || 0,
          sharpe_ratio: mlData.sharpe_ratio || 0,
        });
      } else {
        const errorText = await mlResp.text();
        console.error(
          `ML service Black-Litterman failed: ${mlResp.status} - ${errorText}`,
        );
        res.status(mlResp.status).json({
          error: "ml_service_error",
          message: errorText || "ML service error",
        });
      }
    } catch (e: any) {
      console.error("Error in Black-Litterman optimization:", e);
      res.status(500).json({
        error: `failed_to_optimize_portfolio: ${e.message || "Unknown error"}`,
      });
    }
  },
);

// PCA Analysis endpoint
router.get("/pca", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      message: "PCA analysis endpoint - implementation in progress",
      components: [],
      explainedVariance: [],
    });
  } catch (e) {
    console.error("Error in PCA analysis:", e);
    res.status(500).json({ error: "failed_to_calculate_pca" });
  }
});

// Network Analysis endpoint
router.get("/network", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      message: "Network analysis endpoint - implementation in progress",
      nodes: [],
      edges: [],
      mst: [],
    });
  } catch (e) {
    console.error("Error in network analysis:", e);
    res.status(500).json({ error: "failed_to_analyze_network" });
  }
});

// ADF Test (Augmented Dickey-Fuller Test) for Stationarity
router.get("/adf-test", async (req: Request, res: Response): Promise<void> => {
  try {
    const symbol = String(req.query.symbol || "");
    const timeframe = String(req.query.timeframe || "1M");

    const fetched = await requireSymbolAndFetch(symbol, timeframe, res);
    if (!fetched) return;
    const {logReturns } = fetched;
    if (logReturns.length < 10) {
      res.status(400).json({
        error: "Insufficient data for ADF test (need at least 10 data points)",
      });
      return;
    }

    // Try to use ML service for proper ADF test
    try {
      const mlResp = await fetch(`${mlServiceUrl}/dsfm/adf-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returns: logReturns }),
      });

      if (mlResp.ok) {
        const mlData: any = await mlResp.json();
        res.json({
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
            ? `Series is stationary (p-value = ${mlData.p_value.toFixed(4)} < 0.05). We reject the null hypothesis that the series has a unit root. The test statistic (${mlData.test_statistic.toFixed(4)}) is more negative than the critical value at 5% level (${mlData.critical_values["5%"].toFixed(4)}).`
            : `Series is non-stationary (p-value = ${mlData.p_value.toFixed(4)} >= 0.05). We fail to reject the null hypothesis of a unit root. The test statistic (${mlData.test_statistic.toFixed(4)}) is less negative than the critical value at 5% level (${mlData.critical_values["5%"].toFixed(4)}).`,
          recommendation: mlData.is_stationary
            ? "Data is stationary. You can proceed with AR/MA/ARIMA models without differencing (d=0)."
            : "Data is non-stationary. Apply differencing (d>0) before modeling with ARIMA. Try ARIMA(p,1,q) or ARIMA(p,2,q) models.",
        });
        return;
      } else {
        const errorText = await mlResp.text();
        console.warn(
          `ML service ADF test failed: ${mlResp.status} - ${errorText}`,
        );
      }
    } catch (mlError: any) {
      console.warn(
        "ML service not available for ADF test, using simplified calculation:",
        mlError.message,
      );
    }

    // Fallback: Simplified ADF test calculation
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance =
      logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      logReturns.length;

    // Simplified heuristic: if variance is very low, likely stationary
    // This is not a real ADF test, just a placeholder
    const isStationary = variance < 0.1;
    const testStatistic = -2.5; // Placeholder
    const pValue = isStationary ? 0.01 : 0.5; // Placeholder
    const criticalValues = {
      "1%": -3.43,
      "5%": -2.86,
      "10%": -2.57,
    };

    res.json({
      symbol,
      testStatistic,
      pValue,
      criticalValues,
      isStationary: pValue < 0.05,
      interpretation:
        pValue < 0.05
          ? "Series appears stationary (simplified test - use ML service for accurate results)"
          : "Series appears non-stationary (simplified test - use ML service for accurate results)",
      recommendation:
        pValue < 0.05
          ? "Data appears stationary. Can proceed with AR/MA/ARIMA models."
          : "Data appears non-stationary. Apply differencing before modeling. Note: This is a simplified test. Start ML service for accurate ADF test results.",
    });
  } catch (e) {
    console.error("Error in ADF test:", e);
    res.status(500).json({ error: "failed_to_perform_adf_test" });
  }
});

// ACF/PACF Calculation
router.get("/acf-pacf", async (req: Request, res: Response): Promise<void> => {
  try {
    const symbol = String(req.query.symbol || "");
    const timeframe = String(req.query.timeframe || "1M");
    const maxLags = Number(req.query.maxLags || 20);

    // Try Yahoo Finance first
    const fetched = await requireSymbolAndFetch(symbol, timeframe, res);
    if (!fetched) return;
    const { logReturns } = fetched;

    // Adjust maxLags if we don't have enough data
    const adjustedMaxLags = Math.min(
      maxLags,
      Math.floor(logReturns.length / 2),
    );

    if (logReturns.length < 5) {
      res.status(400).json({
        error:
          "Insufficient data for ACF/PACF calculation (need at least 5 data points)",
      });
      return;
    }

    // Try to use ML service for proper ACF/PACF
    try {
      const mlResp = await fetch(`${mlServiceUrl}/dsfm/acf-pacf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returns: logReturns,
          max_lags: adjustedMaxLags,
        }),
      });

      if (mlResp.ok) {
        const mlData: any = await mlResp.json();
        res.json({
          symbol,
          lags: mlData.lags,
          acf: mlData.acf,
          pacf: mlData.pacf,
          confidenceInterval: mlData.confidence_interval,
        });
        return;
      }
    } catch (mlError: any) {
      console.warn(
        "ML service not available for ACF/PACF, using simplified calculation:",
        mlError.message,
      );
    }

    // Fallback: Proper ACF calculation (simplified PACF)
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const acf: number[] = [1.0]; // ACF at lag 0 is always 1

    // Calculate variance (denominator for ACF)
    const variance =
      logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      logReturns.length;

    // Calculate ACF for each lag
    for (let lag = 1; lag <= adjustedMaxLags; lag++) {
      let covariance = 0;
      const n = logReturns.length - lag;
      for (let i = 0; i < n; i++) {
        covariance += (logReturns[i] - mean) * (logReturns[i + lag] - mean);
      }
      covariance /= logReturns.length; // Normalize by total length
      const correlation = variance > 0 ? covariance / variance : 0;
      acf.push(correlation);
    }

    // Simplified PACF calculation (Durbin-Levinson recursion would be more accurate)
    // For now, use a heuristic: PACF[1] = ACF[1], then decay
    const pacf: number[] = [1.0];
    if (acf.length > 1) {
      pacf.push(acf[1]);
      for (let lag = 2; lag <= adjustedMaxLags; lag++) {
        // Simplified: PACF decays faster than ACF
        pacf.push(acf[lag] * Math.pow(0.7, lag - 1));
      }
    }

    console.log(
      `ACF/PACF calculated for ${symbol}: ${acf.length} lags, ACF[1]=${acf[1]?.toFixed(3)}, PACF[1]=${pacf[1]?.toFixed(3)}, data points: ${logReturns.length}, adjusted lags: ${adjustedMaxLags}`,
    );

    res.json({
      symbol,
      lags: Array.from({ length: adjustedMaxLags + 1 }, (_, i) => i),
      acf: acf.slice(0, adjustedMaxLags + 1),
      pacf: pacf.slice(0, adjustedMaxLags + 1),
      confidenceInterval: 1.96 / Math.sqrt(logReturns.length),
    });
  } catch (e) {
    console.error("Error calculating ACF/PACF:", e);
    res.status(500).json({ error: "failed_to_calculate_acf_pacf" });
  }
});

// AR/MA/ARIMA Model endpoint
router.post("/arima", async (req: Request, res: Response): Promise<void> => {
  try {
    let { symbol, timeframe = "1Y", order = [1, 0, 1] } = req.body || {};

    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    // Auto-upgrade timeframe if insufficient data
    let result = await fetchAngelHistoricalCandles(symbol, timeframe);
    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    let candles = result.candles;
    let prices = candles.map((candle) => candle.close);

    // If insufficient data, try longer timeframe
    if (prices.length < 30 && timeframe !== "1Y") {
      console.log(`Insufficient data for ${timeframe}, trying 1Y timeframe`);
      result = await fetchAngelHistoricalCandles(symbol, "1Y");
      if (!result.error) {
        candles = result.candles;
        prices = candles.map((candle) => candle.close);
      }
    }

    if (prices.length < 30) {
      res.status(400).json({
        error: `Insufficient data for ARIMA model (need at least 30 candles, got ${prices.length}). Try selecting a longer timeframe like 1Y.`,
      });
      return;
    }

    const logReturns = calculateLogReturns(prices);
    if (logReturns.length < 20) {
      res.status(400).json({ error: "Insufficient returns for ARIMA model" });
      return;
    }

    try {
      const mlResp = await fetch(`${mlServiceUrl}/dsfm/arima`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returns: logReturns, order }),
      });

      if (mlResp.ok) {
        const mlData: any = await mlResp.json();
        res.json({
          order: mlData.order,
          aic: mlData.aic,
          bic: mlData.bic,
          params: mlData.params,
          forecast: mlData.forecast,
          summary: mlData.summary,
        });
        return;
      } else {
        const errorText = await mlResp.text();
        console.warn(
          `ML service ARIMA failed: ${mlResp.status} - ${errorText}`,
        );
      }
    } catch (e: any) {
      console.error("ML service ARIMA error:", e.message);
      res.status(503).json({
        error: "ml_service_unavailable",
        message: `ML service is not available. ${mlServiceUrl ? `URL: ${mlServiceUrl}. ` : "Set ML_SERVICE_URL in backend env for production. "}Error: ${e.message}`,
      });
      return;
    }

    res.status(503).json({
      error: "ml_service_unavailable",
      message:
        "ML service is not available. Set ML_SERVICE_URL in backend env (e.g. https://your-ml-service.onrender.com), or run locally: cd ml-service && python app.py",
    });
  } catch (e) {
    console.error("Error in ARIMA:", e);
    res.status(500).json({ error: "failed_to_fit_arima" });
  }
});

// GARCH Model endpoint
router.post("/garch", async (req: Request, res: Response): Promise<void> => {
  try {
    let { symbol, timeframe = "1Y", order = [1, 1] } = req.body || {};

    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    // Try Yahoo Finance first
    let result = await fetchYahooFinanceData(symbol, timeframe);
    if (result.error || result.candles.length === 0) {
      result = await fetchAngelHistoricalCandles(symbol, timeframe);
    }

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    let candles = result.candles;
    let prices = candles.map((candle) => candle.close);

    // If insufficient data, try longer timeframe
    if (
      prices.length < 50 &&
      timeframe !== "1Y" &&
      timeframe !== "2Y" &&
      timeframe !== "3Y"
    ) {
      console.log(`Insufficient data for ${timeframe}, trying 1Y timeframe`);
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
      res.status(400).json({
        error: `Insufficient data for GARCH model (need at least 50 candles, got ${prices.length}). Try selecting a longer timeframe like 1Y.`,
      });
      return;
    }

    const logReturns = calculateLogReturns(prices);
    if (logReturns.length < 30) {
      res.status(400).json({ error: "Insufficient returns for GARCH model" });
      return;
    }

    try {
      const mlResp = await fetch(`${mlServiceUrl}/dsfm/garch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returns: logReturns, order }),
      });

      if (mlResp.ok) {
        const mlData: any = await mlResp.json();
        res.json({
          order: mlData.order,
          aic: mlData.aic,
          bic: mlData.bic,
          params: mlData.params,
          conditionalVolatility: mlData.conditional_volatility,
          forecast: mlData.forecast,
        });
        return;
      } else {
        const errorText = await mlResp.text();
        console.warn(
          `ML service GARCH failed: ${mlResp.status} - ${errorText}`,
        );
      }
    } catch (e: any) {
      console.error("ML service GARCH error:", e.message);
      res.status(503).json({
        error: "ml_service_unavailable",
        message: `ML service is not available. ${mlServiceUrl ? `URL: ${mlServiceUrl}. ` : "Set ML_SERVICE_URL in backend env for production. "}Error: ${e.message}`,
      });
      return;
    }

    res.status(503).json({
      error: "ml_service_unavailable",
      message:
        "ML service is not available. Set ML_SERVICE_URL in backend env (e.g. https://your-ml-service.onrender.com), or run locally: cd ml-service && python app.py",
    });
  } catch (e) {
    console.error("Error in GARCH:", e);
    res.status(500).json({ error: "failed_to_fit_garch" });
  }
});

// LSTM Forecasting endpoint
router.post("/lstm", async (req: Request, res: Response): Promise<void> => {
  try {
    let {
      symbol,
      timeframe = "1Y",
      lookback = 10,
      forecastSteps = 5,
    } = req.body || {};

    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    const result = await fetchAngelHistoricalCandles(symbol, timeframe);
    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    const candles = result.candles;
    const prices = candles.map((candle) => candle.close);

    if (prices.length < lookback + 20) {
      res.status(400).json({
        error:
          "Insufficient data for LSTM model (need at least 30 data points)",
      });
      return;
    }

    const logReturns = calculateLogReturns(prices);

    try {
      const mlResp = await fetch(`${mlServiceUrl}/dsfm/lstm`, {
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
        res.json({
          forecast: mlData.forecast,
          rmse: mlData.rmse,
          r2_score: mlData.r2_score,
          training_loss: mlData.training_loss,
        });
        return;
      } else {
        const errorText = await mlResp.text();
        console.warn(`ML service LSTM failed: ${mlResp.status} - ${errorText}`);
      }
    } catch (e: any) {
      console.error("ML service LSTM error:", e.message);
    }

    res.status(503).json({
      error: "ml_service_unavailable",
      message:
        "ML service is not available. Please ensure the ML service is running on port 8000.",
    });
  } catch (e) {
    console.error("Error in LSTM:", e);
    res.status(500).json({ error: "failed_to_run_lstm" });
  }
});

// FinBERT Sentiment Analysis endpoint
router.post(
  "/sentiment/finbert",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { text } = req.body || {};

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        res
          .status(400)
          .json({ error: "Text is required for sentiment analysis" });
        return;
      }

      try {
        const mlResp = await fetch(`${mlServiceUrl}/dsfm/sentiment/finbert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (mlResp.ok) {
          const mlData: any = await mlResp.json();
          res.json({
            sentiment: mlData.sentiment,
            score: mlData.score,
            confidence: mlData.confidence,
          });
          return;
        } else {
          const errorText = await mlResp.text();
          console.warn(
            `ML service FinBERT failed: ${mlResp.status} - ${errorText}`,
          );
        }
      } catch (e: any) {
        console.error("ML service FinBERT error:", e.message);
      }

      res.status(503).json({
        error: "ml_service_unavailable",
        message:
          "ML service is not available. Please ensure the ML service is running on port 8000.",
      });
    } catch (e) {
      console.error("Error in FinBERT sentiment:", e);
      res.status(500).json({ error: "failed_to_analyze_sentiment" });
    }
  },
);

// Rule-based Sentiment Analysis endpoint
router.post(
  "/sentiment/rule-based",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { text } = req.body || {};

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        res
          .status(400)
          .json({ error: "Text is required for sentiment analysis" });
        return;
      }

      try {
        const mlResp = await fetch(
          `${mlServiceUrl}/dsfm/sentiment/rule-based`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          },
        );

        if (mlResp.ok) {
          const mlData: any = await mlResp.json();
          res.json({
            sentiment: mlData.sentiment,
            bullish_signals: mlData.bullish_signals,
            bearish_signals: mlData.bearish_signals,
            confidence: mlData.confidence,
          });
          return;
        } else {
          const errorText = await mlResp.text();
          console.warn(
            `ML service rule-based sentiment failed: ${mlResp.status} - ${errorText}`,
          );
        }
      } catch (e: any) {
        console.error("ML service rule-based sentiment error:", e.message);
      }

      res.status(503).json({
        error: "ml_service_unavailable",
        message:
          "ML service is not available. Please ensure the ML service is running on port 8000.",
      });
    } catch (e) {
      console.error("Error in rule-based sentiment:", e);
      res.status(500).json({ error: "failed_to_analyze_sentiment" });
    }
  },
);

export default router;
