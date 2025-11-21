"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const market_1 = require("../services/market");
const router = (0, express_1.Router)();
const getEnvTokens = (key) => {
    const raw = process.env[key] || "";
    return raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
};
const defaultExchange = () => process.env.SMARTAPI_DEFAULT_EXCHANGE || "NSE";
router.get("/indices", async (req, res) => {
    try {
        const exchangeTokens = { BSE: ["99919000"], NSE: ["26000"] };
        const quotes = await market_1.marketService.fetchQuotes(exchangeTokens, "FULL");
        return res.json({ status: "success", data: quotes, timestamp: new Date().toISOString() });
    }
    catch (error) {
        return res.status(500).json({ status: "error", message: "Failed to fetch indices", timestamp: new Date().toISOString() });
    }
});
router.post("/quotes", (0, express_validator_1.body)("exchangeTokens").isObject(), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: "error", message: "Validation failed", errors: errors.array() });
    }
    try {
        const { exchangeTokens, mode } = req.body;
        const quotes = await market_1.marketService.fetchQuotes(exchangeTokens, mode || "FULL");
        return res.json({ status: "success", data: quotes, timestamp: new Date().toISOString() });
    }
    catch (error) {
        return res.status(500).json({ status: "error", message: "Failed to fetch quotes", timestamp: new Date().toISOString() });
    }
});
router.post("/candles", (0, express_validator_1.body)("exchange").isString(), (0, express_validator_1.body)("symbolToken").isString(), (0, express_validator_1.body)("interval").isString(), (0, express_validator_1.body)("fromDate").isString(), (0, express_validator_1.body)("toDate").isString(), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: "error", message: "Validation failed", errors: errors.array() });
    }
    try {
        const { exchange, symbolToken, interval, fromDate, toDate } = req.body;
        const candles = await market_1.marketService.getCandleData(exchange, symbolToken, interval, fromDate, toDate);
        return res.json({ status: "success", data: candles, timestamp: new Date().toISOString() });
    }
    catch (error) {
        return res.status(500).json({ status: "error", message: "Failed to fetch candles", timestamp: new Date().toISOString() });
    }
});
router.post("/top-performers", (0, express_validator_1.body)("exchange").optional().isString(), (0, express_validator_1.body)("tokens").optional().isArray(), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: "error", message: "Validation failed", errors: errors.array() });
    }
    try {
        const range = req.query?.range || "1W";
        const exchange = req.body?.exchange || defaultExchange();
        const tokens = req.body?.tokens || getEnvTokens("SMARTAPI_TOKENS_TOP_PERFORMERS");
        const now = new Date();
        const from = new Date(now);
        if (range === "1W")
            from.setDate(now.getDate() - 7);
        else if (range === "1M")
            from.setMonth(now.getMonth() - 1);
        else if (range === "1Y")
            from.setFullYear(now.getFullYear() - 1);
        else if (range === "5Y")
            from.setFullYear(now.getFullYear() - 5);
        const fromDate = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")} 00:00`;
        const toDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 23:59`;
        const changes = [];
        for (const token of tokens) {
            try {
                const candles = await market_1.marketService.getCandleData(exchange, token, "ONE_DAY", fromDate, toDate);
                if (candles.length >= 2) {
                    const first = candles[0];
                    const last = candles[candles.length - 1];
                    const firstClose = first[4];
                    const lastClose = last[4];
                    const changePct = ((lastClose - firstClose) / firstClose) * 100;
                    changes.push({ token, changePercent: changePct });
                }
            }
            catch { }
        }
        const quotes = await market_1.marketService.fetchQuotes({ [exchange]: tokens }, "FULL");
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
    }
    catch (error) {
        return res.status(500).json({ status: "error", message: "Failed to fetch top performers", timestamp: new Date().toISOString() });
    }
});
router.get("/most-bought", async (req, res) => {
    try {
        const exchange = defaultExchange();
        const tokens = getEnvTokens("SMARTAPI_TOKENS_MOST_BOUGHT");
        if (!tokens.length) {
            return res.json({ status: "success", data: [], timestamp: new Date().toISOString() });
        }
        const quotes = await market_1.marketService.fetchQuotes({ [exchange]: tokens }, "FULL");
        const sorted = quotes.sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10);
        return res.json({ status: "success", data: sorted, timestamp: new Date().toISOString() });
    }
    catch (error) {
        return res.status(500).json({ status: "error", message: "Failed to fetch most bought", timestamp: new Date().toISOString() });
    }
});
router.get("/top-movers", async (req, res) => {
    try {
        const exchange = defaultExchange();
        const tokens = getEnvTokens("SMARTAPI_TOKENS_TOP_MOVERS");
        if (!tokens.length) {
            return res.json({ status: "success", data: { gainers: [], losers: [] }, timestamp: new Date().toISOString() });
        }
        const quotes = await market_1.marketService.fetchQuotes({ [exchange]: tokens }, "FULL");
        const gainers = quotes.filter(q => q.changePercent >= 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
        const losers = quotes.filter(q => q.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);
        return res.json({ status: "success", data: { gainers, losers }, timestamp: new Date().toISOString() });
    }
    catch (error) {
        return res.status(500).json({ status: "error", message: "Failed to fetch top movers", timestamp: new Date().toISOString() });
    }
});
router.get("/sector-movements", async (req, res) => {
    try {
        const sector = req.query.sector || "IT_SOFTWARE";
        const exchange = defaultExchange();
        const envKey = `SMARTAPI_TOKENS_SECTOR_${sector.toUpperCase()}`;
        const tokens = getEnvTokens(envKey);
        if (!tokens.length) {
            return res.json({ status: "success", data: { gainers: [], losers: [] }, timestamp: new Date().toISOString() });
        }
        const quotes = await market_1.marketService.fetchQuotes({ [exchange]: tokens }, "FULL");
        const gainers = quotes.filter(q => q.changePercent >= 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
        const losers = quotes.filter(q => q.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);
        return res.json({ status: "success", data: { gainers, losers }, timestamp: new Date().toISOString() });
    }
    catch (error) {
        return res.status(500).json({ status: "error", message: "Failed to fetch sector movements", timestamp: new Date().toISOString() });
    }
});
exports.default = router;
//# sourceMappingURL=market.js.map