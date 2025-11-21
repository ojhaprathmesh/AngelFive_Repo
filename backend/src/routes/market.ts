import { Router } from "express";
import { body, query, validationResult } from "express-validator";
import { marketService } from "../services/market";
import { instrumentsService } from "../services/instruments";

const router = Router();

const getEnvTokens = (key: string): string[] => {
  const raw = process.env[key] || "";
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
};

const defaultExchange = (): string => process.env.SMARTAPI_DEFAULT_EXCHANGE || "NSE";

const getTokensFromEnvOrSymbols = async (exchange: string, tokensKey: string, symbolsKey?: string): Promise<string[]> => {
  const tokens = getEnvTokens(tokensKey);
  if (tokens.length) return tokens;
  const symbolsRaw = process.env[symbolsKey || ""] || "";
  const symbols = symbolsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!symbols.length) return [];
  const mapped = await instrumentsService.getTokensForSymbols(exchange, symbols);
  return mapped;
};

router.get(
  "/indices",
  async (req, res) => {
    try {
      const exchangeTokens = { BSE: ["99919000"], NSE: ["26000"] };
      const quotes = await marketService.fetchQuotes(exchangeTokens, "FULL");
      return res.json({ status: "success", data: quotes, timestamp: new Date().toISOString() });
    } catch (error) {
      return res.status(500).json({ status: "error", message: "Failed to fetch indices", timestamp: new Date().toISOString() });
    }
  }
);

router.post(
  "/quotes",
  body("exchangeTokens").isObject(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: "error", message: "Validation failed", errors: errors.array() });
    }
    try {
      const { exchangeTokens, mode } = req.body as { exchangeTokens: Record<string, string[]>; mode?: "FULL" | "OHLC" | "LTP" };
      const quotes = await marketService.fetchQuotes(exchangeTokens, mode || "FULL");
      return res.json({ status: "success", data: quotes, timestamp: new Date().toISOString() });
    } catch (error) {
      return res.status(500).json({ status: "error", message: "Failed to fetch quotes", timestamp: new Date().toISOString() });
    }
  }
);

router.post(
  "/candles",
  body("exchange").isString(),
  body("symbolToken").isString(),
  body("interval").isString(),
  body("fromDate").isString(),
  body("toDate").isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: "error", message: "Validation failed", errors: errors.array() });
    }
    try {
      const { exchange, symbolToken, interval, fromDate, toDate } = req.body as {
        exchange: string;
        symbolToken: string;
        interval: string;
        fromDate: string;
        toDate: string;
      };
      const candles = await marketService.getCandleData(exchange, symbolToken, interval, fromDate, toDate);
      return res.json({ status: "success", data: candles, timestamp: new Date().toISOString() });
    } catch (error) {
      return res.status(500).json({ status: "error", message: "Failed to fetch candles", timestamp: new Date().toISOString() });
    }
  }
);

router.post(
  "/top-performers",
  body("exchange").optional().isString(),
  body("tokens").optional().isArray(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: "error", message: "Validation failed", errors: errors.array() });
    }
    try {
      const range = (req.query?.range as string) || "1W"; // 1W, 1M, 1Y, 5Y
      const exchange = (req.body?.exchange as string) || defaultExchange();
      const tokens = (req.body?.tokens as string[]) || getEnvTokens("SMARTAPI_TOKENS_TOP_PERFORMERS");

      const now = new Date();
      const from = new Date(now);
      if (range === "1W") from.setDate(now.getDate() - 7);
      else if (range === "1M") from.setMonth(now.getMonth() - 1);
      else if (range === "1Y") from.setFullYear(now.getFullYear() - 1);
      else if (range === "5Y") from.setFullYear(now.getFullYear() - 5);

      const fromDate = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")} 00:00`;
      const toDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 23:59`;

      const changes: Array<{ token: string; changePercent: number }> = [];

      for (const token of tokens) {
        try {
          const candles = await marketService.getCandleData(exchange, token, "ONE_DAY", fromDate, toDate);
          if (candles.length >= 2) {
            const first = candles[0];
            const last = candles[candles.length - 1];
            const firstClose = first[4];
            const lastClose = last[4];
            const changePct = ((lastClose - firstClose) / firstClose) * 100;
            changes.push({ token, changePercent: changePct });
          }
        } catch {}
      }

      const quotes = await marketService.fetchQuotes({ [exchange]: tokens }, "FULL");
      const quoteMap = new Map(quotes.map(q => [q.token || "", q]));
      const merged = changes
        .map(c => {
          const q = quoteMap.get(c.token);
          return {
            symbol: q?.symbol || c.token,
            price: q?.price || 0,
            changePercent: c.changePercent,
          };
        })
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 10);
      return res.json({ status: "success", data: merged, timestamp: new Date().toISOString() });
    } catch (error) {
      return res.status(500).json({ status: "error", message: "Failed to fetch top performers", timestamp: new Date().toISOString() });
    }
  }
);

router.get("/most-bought", async (req, res) => {
  try {
    const exchange = defaultExchange();
    const tokens = await getTokensFromEnvOrSymbols(exchange, "SMARTAPI_TOKENS_MOST_BOUGHT", "SMARTAPI_SYMBOLS_MOST_BOUGHT");
    if (!tokens.length) {
      return res.json({ status: "success", data: [], timestamp: new Date().toISOString() });
    }
    const quotes = await marketService.fetchQuotes({ [exchange]: tokens }, "FULL");
    const sorted = quotes.sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10);
    return res.json({ status: "success", data: sorted, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Failed to fetch most bought", timestamp: new Date().toISOString() });
  }
});

router.get("/top-movers", async (req, res) => {
  try {
    const exchange = defaultExchange();
    const tokens = await getTokensFromEnvOrSymbols(exchange, "SMARTAPI_TOKENS_TOP_MOVERS", "SMARTAPI_SYMBOLS_TOP_MOVERS");
    if (!tokens.length) {
      return res.json({ status: "success", data: { gainers: [], losers: [] }, timestamp: new Date().toISOString() });
    }
    const quotes = await marketService.fetchQuotes({ [exchange]: tokens }, "FULL");
    const gainers = quotes.filter(q => q.changePercent >= 0).sort((a,b) => b.changePercent - a.changePercent).slice(0, 10);
    const losers = quotes.filter(q => q.changePercent < 0).sort((a,b) => a.changePercent - b.changePercent).slice(0, 10);
    return res.json({ status: "success", data: { gainers, losers }, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Failed to fetch top movers", timestamp: new Date().toISOString() });
  }
});

router.get("/sector-movements", async (req, res) => {
  try {
    const sector = (req.query.sector as string) || "IT_SOFTWARE";
    const exchange = defaultExchange();
    const envKeyTokens = `SMARTAPI_TOKENS_SECTOR_${sector.toUpperCase()}`;
    const envKeySymbols = `SMARTAPI_SYMBOLS_SECTOR_${sector.toUpperCase()}`;
    const tokens = await getTokensFromEnvOrSymbols(exchange, envKeyTokens, envKeySymbols);
    if (!tokens.length) {
      return res.json({ status: "success", data: { gainers: [], losers: [] }, timestamp: new Date().toISOString() });
    }
    const quotes = await marketService.fetchQuotes({ [exchange]: tokens }, "FULL");
    const gainers = quotes.filter(q => q.changePercent >= 0).sort((a,b) => b.changePercent - a.changePercent).slice(0, 10);
    const losers = quotes.filter(q => q.changePercent < 0).sort((a,b) => a.changePercent - b.changePercent).slice(0, 10);
    return res.json({ status: "success", data: { gainers, losers }, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Failed to fetch sector movements", timestamp: new Date().toISOString() });
  }
});

export default router;