import express, { Request, Response } from "express";
import {
  hasSmartApiCredentials,
  fetchSmartApiQuotes,
  fetchSmartApiCandles,
} from "../lib/smartapi";
import { swrCache, TTL } from "../services/cache";

const router = express.Router();

type Quote = {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume?: number;
};

interface SmartApiItem {
  tradingSymbol: string;
  percentChange?: number;
  symbolToken?: number;
  opnInterest?: number;
  netChangeOpnInterest?: number;
}

interface SmartApiGainersResponse {
  status: boolean;
  message?: string;
  errorcode?: string;
  data?: SmartApiItem[];
}

let cookieCache = "";
let cookieTime = 0;
const COOKIE_TTL_MS = 10 * 60 * 1000;

async function getNSECookie(): Promise<string> {
  if (cookieCache && Date.now() - cookieTime < COOKIE_TTL_MS)
    return cookieCache;
  const resp = await fetch("https://www.nseindia.com/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const cookieHeader = resp.headers.get("set-cookie") || "";
  cookieCache = cookieHeader;
  cookieTime = Date.now();
  return cookieHeader;
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
  const rows: any[] = json?.data || [];
  return rows;
}

function formatDateForNSE(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

async function fetchDiscoveryData() {
  const rows = await fetchNSEIndex("NIFTY 500");
  const map = (r: any): Quote => ({
    symbol: String(r?.symbol || ""),
    regularMarketPrice: Number(r?.lastPrice || 0),
    regularMarketChange: Number(r?.change || 0),
    regularMarketChangePercent: Number(r?.pChange || 0),
    regularMarketVolume: Number(r?.totalTradedVolume || 0),
  });
  const quotes: Quote[] = rows.map(map);
  const mostBought = [...quotes]
    .sort((a, b) => (b.regularMarketVolume || 0) - (a.regularMarketVolume || 0))
    .slice(0, 8);
  const topGainers = [...quotes]
    .sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent)
    .slice(0, 8);
  const topLosers = [...quotes]
    .sort((a, b) => a.regularMarketChangePercent - b.regularMarketChangePercent)
    .slice(0, 8);
  const under50 = quotes.filter((q) => q.regularMarketPrice < 50).slice(0, 8);
  const under100 = quotes.filter((q) => q.regularMarketPrice < 100).slice(0, 8);
  const under200 = quotes.filter((q) => q.regularMarketPrice < 200).slice(0, 8);
  return {
    mostBought,
    topGainers,
    topLosers,
    pocketFriendly: { under50, under100, under200 },
  };
}

router.get("/discovery", async (req: Request, res: Response) => {
  try {
    const data = await swrCache.get(
      "discovery",
      fetchDiscoveryData,
      TTL.DISCOVERY,
    );
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "failed_to_fetch_discovery" });
  }
});

async function fetchNSEHistoricalPrice(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<{ startPrice: number; endPrice: number } | null> {
  try {
    const cookie = await getNSECookie();
    // NSE historical equity API - use proper encoded series and DD-MM-YYYY dates
    const seriesParam = encodeURIComponent('["EQ"]');
    const url = `https://www.nseindia.com/api/historical/cm/equity?symbol=${encodeURIComponent(symbol)}&series=${seriesParam}&from=${fromDate}&to=${toDate}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
        Cookie: cookie,
      },
    });
    if (!resp.ok) {
      console.log(
        `[Historical] Failed for ${symbol}: ${resp.status} ${resp.statusText}`,
      );
      return null;
    }
    const json: any = await resp.json();
    const data = json?.data || [];
    if (data.length === 0) {
      console.log(`[Historical] No data for ${symbol}`);
      return null;
    }

    // Sort by date
    const sorted = data.sort(
      (a: any, b: any) =>
        new Date(a.CH_TIMESTAMP).getTime() - new Date(b.CH_TIMESTAMP).getTime(),
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startPrice = Number(
      first.CH_CLOSING_PRICE || first.CH_OPENING_PRICE || 0,
    );
    const endPrice = Number(last.CH_CLOSING_PRICE || 0);

    if (startPrice <= 0 || endPrice <= 0) {
      console.log(
        `[Historical] Invalid prices for ${symbol}: start=${startPrice}, end=${endPrice}`,
      );
      return null;
    }

    return { startPrice, endPrice };
  } catch (e) {
    console.error(`[Historical] Error fetching data for ${symbol}:`, e);
    return null;
  }
}

async function fetchPerformersData(
  tf: string,
): Promise<Array<{ symbol: string; price: number; changePct: number }>> {
  console.log(`[Performers] Fetching fresh data for timeframe: ${tf}`);

  const rows = await fetchNSEIndex("NIFTY 500");
  if (rows.length === 0) {
    console.log("[Performers] No data from NSE index");
    return [];
  }

  // Calculate date range based on timeframe
  const now = new Date();
  const from = new Date(now);
  if (tf === "1W") from.setDate(now.getDate() - 7);
  else if (tf === "1M") from.setMonth(now.getMonth() - 1);
  else if (tf === "1Y") from.setFullYear(now.getFullYear() - 1);
  else if (tf === "5Y") from.setFullYear(now.getFullYear() - 5);
  else from.setMonth(now.getMonth() - 1); // default to 1M

  const fromIso = from.toISOString().split("T")[0];
  const toIso = now.toISOString().split("T")[0];
  console.log(`[Performers] Date range: ${fromIso} to ${toIso}`);

  // NSE historical API expects DD-MM-YYYY
  const fromDateStr = formatDateForNSE(from);
  const toDateStr = formatDateForNSE(now);

  // Get current prices
  const quotes: Quote[] = rows.map((r: any) => ({
    symbol: String(r?.symbol || ""),
    regularMarketPrice: Number(r?.lastPrice || 0),
    regularMarketChange: Number(r?.change || 0),
    regularMarketChangePercent: Number(r?.pChange || 0),
    regularMarketVolume: Number(r?.totalTradedVolume || 0),
  }));

  // Filter valid stocks with good volume, sort by volume
  const validStocks = quotes
    .filter(
      (q) => q.regularMarketPrice > 0 && (q.regularMarketVolume || 0) > 10000,
    )
    .sort((a, b) => (b.regularMarketVolume || 0) - (a.regularMarketVolume || 0))
    .slice(0, 30); // Limit to top 30 by volume to avoid too many API calls

  console.log(`[Performers] Processing ${validStocks.length} stocks`);

  // Fetch historical data and calculate performance
  const performers: Array<{
    symbol: string;
    price: number;
    changePct: number;
  }> = [];

  // Process stocks to get historical performance
  for (let i = 0; i < validStocks.length; i++) {
    if (performers.length >= 8) break;

    const stock = validStocks[i];
    const historical = await fetchNSEHistoricalPrice(
      stock.symbol,
      fromDateStr,
      toDateStr,
    );

    if (historical && historical.startPrice > 0) {
      const changePct =
        ((historical.endPrice - historical.startPrice) /
          historical.startPrice) *
        100;
      performers.push({
        symbol: stock.symbol,
        price: stock.regularMarketPrice,
        changePct: changePct,
      });
      console.log(
        `[Performers] ${stock.symbol}: ${changePct.toFixed(2)}% (${historical.startPrice} -> ${historical.endPrice})`,
      );
    }
  }

  console.log(
    `[Performers] Found ${performers.length} stocks with historical data`,
  );

  // If we don't have enough historical data, use a different approach
  if (performers.length < 8) {
    console.log(
      `[Performers] Only found ${performers.length} stocks with historical data, using estimated performance`,
    );

    const remainingStocks = validStocks.filter(
      (q) =>
        !performers.find((p) => p.symbol === q.symbol) &&
        q.regularMarketPrice > 0,
    );

    const timeframeMultipliers: Record<string, number> = {
      "1W": 2.0,
      "1M": 5.0,
      "1Y": 25.0,
      "5Y": 80.0,
    };

    const multiplier = timeframeMultipliers[tf] || 1.0;

    const estimated = remainingStocks
      .map((q) => {
        const volumeScore = Math.log10((q.regularMarketVolume || 1) / 1000000);
        const changeScore = q.regularMarketChangePercent * multiplier;
        const combinedScore = changeScore + volumeScore * 0.5;

        return {
          symbol: q.symbol,
          price: q.regularMarketPrice,
          changePct: changeScore,
          score: combinedScore,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8 - performers.length)
      .map(({ symbol, price, changePct }) => ({
        symbol,
        price,
        changePct,
      }));

    performers.push(...estimated);
    console.log(
      `[Performers] Added ${estimated.length} estimated performers for ${tf} using multiplier ${multiplier}x`,
    );
  }

  // Sort by change percentage and return top 8
  performers.sort((a, b) => b.changePct - a.changePct);
  const result = performers.slice(0, 8);
  console.log(
    `[Performers] Returning ${result.length} performers for timeframe ${tf}`,
  );
  return result;
}

router.get(
  "/performers",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tf = String(req.query.tf || "1M");
      const cacheKey = `performers:${tf}`;
      const performers = await swrCache.get(
        cacheKey,
        () => fetchPerformersData(tf),
        TTL.PERFORMERS,
      );
      res.json({ performers });
    } catch (e) {
      console.error("[Performers] Error:", e);
      res.status(500).json({ error: "failed_to_fetch_performers" });
    }
  },
);

router.get("/quotes", async (req: Request, res: Response): Promise<void> => {
  try {
    const symbolsParam = String(req.query.symbols || "").trim();
    if (!symbolsParam) {
      res.json({ quotes: [] });
      return;
    }
    const wanted = symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const rows = await fetchNSEIndex("NIFTY 500");
    const mapRow = (r: any): Quote => ({
      symbol: String(r?.symbol || "").toUpperCase(),
      regularMarketPrice: Number(r?.lastPrice || 0),
      regularMarketChange: Number(r?.change || 0),
      regularMarketChangePercent: Number(r?.pChange || 0),
      regularMarketVolume: Number(r?.totalTradedVolume || 0),
    });
    const quotesAll: Quote[] = rows.map(mapRow);
    const filtered = quotesAll
      .filter((q) => wanted.includes(q.symbol))
      .map((q) => ({
        symbol: q.symbol,
        price: q.regularMarketPrice,
        changePct: q.regularMarketChangePercent,
        exchange: "NSE",
      }));
    res.json({ quotes: filtered });
  } catch (e) {
    res.status(500).json({ error: "failed_to_fetch_quotes" });
  }
});

router.get(
  "/stock-overview",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const symbol = String(req.query.symbol || "")
        .trim()
        .toUpperCase();
      if (!symbol) {
        res.status(400).json({ error: "symbol_required" });
        return;
      }

      const cookie = await getNSECookie();
      const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
          Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
          Cookie: cookie,
        },
      });

      if (!resp.ok) {
        console.error(
          `[stock-overview] NSE response ${resp.status} for ${symbol}`,
        );
        res
          .status(resp.status)
          .json({ error: "failed_to_fetch_stock_overview" });
        return;
      }

      const json: any = await resp.json();
      const info = json?.info || {};
      const priceInfo = json?.priceInfo || {};
      const securityInfo = json?.securityInfo || {};
      const metadata = json?.metadata || {};
      const industryInfo = json?.industryInfo || {};

      const intraDay =
        priceInfo?.intraDayHighLow || priceInfo?.dayHighLow || {};
      const weekHighLow = priceInfo?.weekHighLow || {};
      const priceBand = securityInfo?.priceBand || {};

      const data = {
        symbol: info?.symbol || symbol,
        companyName: info?.companyName || info?.longName || symbol,
        industry:
          info?.industry ||
          industryInfo?.industry ||
          metadata?.industry ||
          null,
        lastPrice: priceInfo?.lastPrice ?? null,
        change: priceInfo?.change ?? null,
        pChange: priceInfo?.pChange ?? null,
        open: priceInfo?.open ?? null,
        dayHigh: intraDay?.max ?? priceInfo?.dayHigh ?? null,
        dayLow: intraDay?.min ?? priceInfo?.dayLow ?? null,
        previousClose: priceInfo?.prevClose ?? priceInfo?.close ?? null,
        averagePrice: priceInfo?.vwap ?? null,
        totalTradedVolume: priceInfo?.totalTradedVolume ?? null,
        totalTradedValue: priceInfo?.totalTradedValue ?? null,
        bid: priceInfo?.bid ?? null,
        ask: priceInfo?.ask ?? null,
        upperCircuit: priceInfo?.upperCP ?? priceBand?.upper ?? null,
        lowerCircuit: priceInfo?.lowerCP ?? priceBand?.lower ?? null,
        weekHigh: weekHighLow?.max ?? null,
        weekHighDate: weekHighLow?.maxDate ?? null,
        weekLow: weekHighLow?.min ?? null,
        weekLowDate: weekHighLow?.minDate ?? null,
        faceValue: securityInfo?.faceValue ?? null,
        isin: securityInfo?.isin ?? null,
        marketCap:
          securityInfo?.issuedSize && priceInfo?.lastPrice
            ? Number(securityInfo.issuedSize) * Number(priceInfo.lastPrice)
            : (securityInfo?.marketCap ?? null),
        pe: metadata?.pdSymbolPe ?? metadata?.pe ?? null,
        pb: metadata?.pb ?? null,
        eps: metadata?.eps ?? null,
        dividendYield: metadata?.dividendYield ?? null,
        roe: metadata?.roe ?? null,
        beta: metadata?.beta ?? null,
        sectorPe: metadata?.pdSectorPe ?? null,
        lastUpdateTime: priceInfo?.lastUpdateTime ?? null,
      };

      res.json({ data });
    } catch (e) {
      console.error("[stock-overview] Error:", e);
      res.status(500).json({ error: "failed_to_fetch_stock_overview" });
    }
  },
);

// Get symbol token for a given symbol
router.get(
  "/symbol-token",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const symbol = String(req.query.symbol || "")
        .trim()
        .toUpperCase();
      const exchange = String(req.query.exchange || "NSE").toUpperCase();

      if (!symbol) {
        res.status(400).json({ error: "symbol parameter required" });
        return;
      }

      // Try to get token from instrument master
      const instruments = await loadInstrumentMaster();
      console.log(
        `[symbol-token] Looking for ${symbol} on ${exchange}, total instruments: ${instruments.length}`,
      );

      // Try multiple matching strategies
      let match = instruments.find((item) => {
        if (item.exch_seg?.toUpperCase() !== exchange) return false;
        const candidates = [
          item.symbol?.toUpperCase(),
          item.name?.toUpperCase(),
          item.tradingsymbol?.toUpperCase(),
        ];
        const symbolUpper = symbol.toUpperCase();
        return candidates.some(
          (candidate) =>
            candidate === symbolUpper ||
            candidate === `${symbolUpper}-EQ` ||
            (candidate && candidate.startsWith(`${symbolUpper}-`)),
        );
      });

      // If not found, try without exchange filter (broader search)
      if (!match) {
        console.log(
          `[symbol-token] Not found with exchange filter, trying without...`,
        );
        match = instruments.find((item) => {
          const candidates = [
            item.symbol?.toUpperCase(),
            item.name?.toUpperCase(),
            item.tradingsymbol?.toUpperCase(),
          ];
          const symbolUpper = symbol.toUpperCase();
          return candidates.some(
            (candidate) =>
              candidate === symbolUpper ||
              candidate === `${symbolUpper}-EQ` ||
              (candidate && candidate.startsWith(`${symbolUpper}-`)),
          );
        });
        if (match) {
          console.log(
            `[symbol-token] Found without exchange filter, using exchange: ${match.exch_seg}`,
          );
        }
      }

      // If still not found, try partial matching
      if (!match) {
        console.log(`[symbol-token] Trying partial match...`);
        const symbolUpper = symbol.toUpperCase();
        match = instruments.find((item) => {
          const candidates = [
            item.symbol?.toUpperCase(),
            item.name?.toUpperCase(),
            item.tradingsymbol?.toUpperCase(),
          ];
          return candidates.some(
            (candidate) =>
              candidate &&
              (candidate.includes(symbolUpper) ||
                symbolUpper.includes(candidate?.replace(/-EQ$/, "") || "")),
          );
        });
      }

      if (match && match.token) {
        res.json({
          exchange: match.exch_seg?.toUpperCase() || exchange,
          token: String(match.token),
          symbol: match.symbol || match.name || symbol,
        });
        return;
      }

      res.status(404).json({ error: "Token not found", symbol, exchange });
    } catch (e) {
      console.error("Error getting symbol token:", e);
      res.status(500).json({ error: "failed_to_get_symbol_token" });
    }
  },
);

async function loadInstrumentMaster(): Promise<any[]> {
  return swrCache.get(
    "instrument-master",
    async () => {
      try {
        const resp = await fetch(
          "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json",
        );
        if (resp.ok) {
          const data = await resp.json();
          return Array.isArray(data) ? data : [];
        }
      } catch (e) {
        console.error("Failed to load instrument master:", e);
      }
      return [];
    },
    TTL.INSTRUMENT_MASTER,
  );
}

// SmartAPI proxy endpoints - credentials stay on backend, frontend calls these
const INDEX_TOKEN_MAP: Record<string, { exchange: string; token: string }> = {
  "BSE:SENSEX": { exchange: "BSE", token: "99919000" },
  "NSE:NIFTY": { exchange: "NSE", token: "99926000" },
  "NSE:BANKNIFTY": { exchange: "NSE", token: "99926009" },
  "NSE:INDIAVIX": { exchange: "NSE", token: "99926017" },
  "NSE:FINNIFTY": { exchange: "NSE", token: "99926037" },
  "SBIN-EQ": { exchange: "NSE", token: "3045" },
};

router.post(
  "/smartapi/quote",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbols, exchangeTokens: bodyExchangeTokens } = req.body || {};
      let exchangeTokens: Record<string, string[]> = bodyExchangeTokens || {};

      if (
        Object.keys(exchangeTokens).length === 0 &&
        Array.isArray(symbols) &&
        symbols.length > 0
      ) {
        for (const symbol of symbols) {
          let info = INDEX_TOKEN_MAP[symbol];
          if (!info) {
            const instruments = await loadInstrumentMaster();
            const upper = symbol.toUpperCase();
            const match = instruments.find((item: any) => {
              const candidates = [
                item.symbol?.toUpperCase(),
                item.name?.toUpperCase(),
                item.tradingsymbol?.toUpperCase(),
              ];
              return candidates.some(
                (c) =>
                  c === upper ||
                  c === `${upper}-EQ` ||
                  (c && c.startsWith(`${upper}-`)),
              );
            });
            if (match?.token) {
              info = {
                exchange: match.exch_seg || "NSE",
                token: String(match.token),
              };
            }
          }
          if (info) {
            if (!exchangeTokens[info.exchange])
              exchangeTokens[info.exchange] = [];
            exchangeTokens[info.exchange].push(info.token);
          }
        }
      }

      if (Object.keys(exchangeTokens).length === 0) {
        res.json({
          quotes: [],
          source: null,
          error: "SmartAPI credentials not configured",
        });
        return;
      }

      if (!hasSmartApiCredentials()) {
        res.json({
          quotes: [],
          source: null,
          error: "SmartAPI credentials not configured",
        });
        return;
      }

      const quotes = await fetchSmartApiQuotes(exchangeTokens);
      res.json({ quotes, source: "smartapi" });
    } catch (e) {
      console.error("[smartapi/quote] Error:", e);
      res.status(500).json({ error: "failed_to_fetch_quote" });
    }
  },
);

router.get(
  "/smartapi/candles",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const exchange = String(req.query.exchange || "NSE").toUpperCase();
      const symbolToken = String(req.query.token || "").trim();
      const interval = String(req.query.interval || "ONE_DAY");
      const fromDate = String(req.query.from || "");
      const toDate = String(req.query.to || "");

      if (!symbolToken || !fromDate || !toDate) {
        res.status(400).json({ error: "token, from, and to are required" });
        return;
      }

      if (!hasSmartApiCredentials()) {
        res.json({ candles: [], error: "SmartAPI credentials not configured" });
        return;
      }

      // Intraday intervals get a short TTL; historical get a longer one
      const intradayIntervals = [
        "ONE_MINUTE",
        "THREE_MINUTE",
        "FIVE_MINUTE",
        "TEN_MINUTE",
        "FIFTEEN_MINUTE",
        "THIRTY_MINUTE",
      ];
      const isIntraday = intradayIntervals.includes(interval.toUpperCase());
      const ttl = isIntraday ? TTL.CHART_INTRADAY : TTL.CHART_HISTORICAL;

      const cacheKey = `candles:${exchange}:${symbolToken}:${interval}:${fromDate}:${toDate}`;
      const candles = await swrCache.get(
        cacheKey,
        () =>
          fetchSmartApiCandles(
            exchange,
            symbolToken,
            interval,
            fromDate,
            toDate,
          ),
        ttl,
      );

      res.json({ candles });
    } catch (e) {
      console.error("[smartapi/candles] Error:", e);
      res.status(500).json({ error: "failed_to_fetch_candles" });
    }
  },
);

// Yahoo Finance proxy endpoint to avoid CORS
router.get(
  "/yahoo-finance",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const symbol = String(req.query.symbol || "")
        .trim()
        .toUpperCase();
      if (!symbol) {
        res.status(400).json({ error: "Symbol is required" });
        return;
      }

      // Try multiple symbol formats
      const symbolFormats = [
        `${symbol}.NS`, // NSE
        `${symbol}.BO`, // BSE
        symbol, // Direct
      ];

      // Replace the hardcoded date range section in the /yahoo-finance route with this:

      const timeframe = String(req.query.timeframe || "1Y").toUpperCase();

      // Determine interval and date range based on timeframe
      let interval: string;
      let from: number;
      const to = Math.floor(Date.now() / 1000);

      switch (timeframe) {
        case "1D":
          interval = "5m";
          from = to - 1 * 24 * 60 * 60;
          break;
        case "5D":
          interval = "30m";
          from = to - 5 * 24 * 60 * 60;
          break;
        case "1M":
          interval = "1d";
          from = to - 30 * 24 * 60 * 60;
          break;
        case "3M":
          interval = "1d";
          from = to - 90 * 24 * 60 * 60;
          break;
        case "6M":
          interval = "1d";
          from = to - 180 * 24 * 60 * 60;
          break;
        default: // 1Y and beyond
          interval = "1d";
          from = to - 365 * 24 * 60 * 60;
          break;
      }

      for (const yahooSymbol of symbolFormats) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${from}&period2=${to}&interval=${interval}&events=history`;

          console.log(`[Yahoo Finance] Trying: ${yahooSymbol}`);

          const response = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            console.warn(
              `[Yahoo Finance] Error for ${yahooSymbol}: ${response.status}`,
            );
            continue;
          }

          const data: any = await response.json();

          if (data.chart?.error) {
            console.warn(
              `[Yahoo Finance] API error for ${yahooSymbol}:`,
              data.chart.error,
            );
            continue;
          }

          const result = data.chart?.result?.[0];

          if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
            console.warn(`[Yahoo Finance] Invalid response for ${yahooSymbol}`);
            continue;
          }

          const timestamps = result.timestamp;
          const quote = result.indicators.quote[0];
          const opens = quote.open || [];
          const highs = quote.high || [];
          const lows = quote.low || [];
          const closes = quote.close || [];
          const volumes = quote.volume || [];

          const candles: Array<
            [string, number, number, number, number, number]
          > = [];

          for (let i = 0; i < timestamps.length; i++) {
            const timestamp = timestamps[i];
            const open = opens[i];
            const high = highs[i];
            const low = lows[i];
            const close = closes[i];
            const volume = volumes[i] || 0;

            if (open == null || high == null || low == null || close == null) {
              continue;
            }

            const date = new Date(timestamp * 1000);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

            candles.push([dateStr, open, high, low, close, volume]);
          }

          if (candles.length > 0) {
            console.log(
              `[Yahoo Finance] ✅ Success for ${yahooSymbol}: ${candles.length} candles`,
            );
            res.json({ candles, symbol: yahooSymbol });
            return;
          }
        } catch (e: any) {
          console.warn(
            `[Yahoo Finance] Error trying ${yahooSymbol}:`,
            e.message,
          );
          continue;
        }
      }

      console.error(`[Yahoo Finance] ❌ All formats failed for: ${symbol}`);
      res.status(404).json({ error: `Unable to fetch data for ${symbol}` });
    } catch (e: any) {
      console.error("[Yahoo Finance] Error:", e);
      res
        .status(500)
        .json({ error: e.message || "Failed to fetch Yahoo Finance data" });
    }
  },
);

// Debug endpoint — see what's cached and how fresh it is
router.get("/cache-status", (_req: Request, res: Response) => {
  res.json({ entries: swrCache.status() });
});

export default router;
router.post("/gainers-losers", async (req: Request, res: Response) => {
  try {
    const { datatype = "PercPriceGainers", expirytype = "NEAR" } =
      req.body || {};
    const url =
      "https://apiconnect.angelone.in/rest/secure/angelbroking/marketData/v1/gainersLosers";
    const apiKey = process.env.SMARTAPI_API_KEY;
    const jwt = process.env.SMARTAPI_JWT_TOKEN;
    const localIp = process.env.SMARTAPI_LOCAL_IP || "127.0.0.1";
    const publicIp = process.env.SMARTAPI_PUBLIC_IP || "127.0.0.1";
    const mac = process.env.SMARTAPI_MAC_ADDRESS || "00:00:00:00:00:00";
    let smartData: SmartApiGainersResponse | null = null;
    if (apiKey && jwt) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-ClientLocalIP": localIp,
            "X-ClientPublicIP": publicIp,
            "X-MACAddress": mac,
            "X-PrivateKey": apiKey,
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ datatype, expirytype }),
        });
        if (resp.ok) {
          smartData = (await resp.json()) as SmartApiGainersResponse;
        }
      } catch {}
    }
    if (
      smartData &&
      smartData.status === true &&
      Array.isArray(smartData.data)
    ) {
      const isLosers = datatype.toLowerCase().includes("losers");
      const items = smartData.data.map((item: any) => ({
        ...item,
        percentChange: isLosers
          ? -Math.abs(Number(item.percentChange || 0))
          : Number(item.percentChange || 0),
      }));
      return res.json({ source: "smartapi", items });
    }

    const rows = await fetchNSEIndex("NIFTY 500");
    const quotes: Quote[] = rows.map((r: any) => ({
      symbol: String(r?.symbol || ""),
      regularMarketPrice: Number(r?.lastPrice || 0),
      regularMarketChangePercent: Number(r?.pChange || 0),
      regularMarketChange: Number(r?.change || 0),
      regularMarketVolume: Number(r?.totalTradedVolume || 0),
    }));
    const gainers = [...quotes]
      .sort(
        (a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent,
      )
      .slice(0, 15);
    const losers = [...quotes]
      .sort(
        (a, b) => a.regularMarketChangePercent - b.regularMarketChangePercent,
      )
      .slice(0, 15);
    return res.json({ source: "nse", gainers, losers });
  } catch (e) {
    return res.status(500).json({ error: "failed_to_fetch_gainers_losers" });
  }
});
