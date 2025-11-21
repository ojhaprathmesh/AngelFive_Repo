"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const router = express_1.default.Router();
let instrumentCache = null;
let instrumentCacheTime = 0;
const INSTRUMENT_TTL_MS = 10 * 60 * 1000;
const QUOTE_TTL_MS = 60 * 1000;
const PERFORMER_TTL_MS = 5 * 60 * 1000;
const quoteCache = new Map();
const performerCache = new Map();
async function getInstrumentMaster() {
    if (instrumentCache && Date.now() - instrumentCacheTime < INSTRUMENT_TTL_MS)
        return instrumentCache;
    const resp = await fetch('https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json');
    if (!resp.ok)
        return [];
    const instruments = (await resp.json());
    instrumentCache = instruments;
    instrumentCacheTime = Date.now();
    return instruments;
}
function toYahooSymbols(tokens, limit = 60) {
    const list = tokens
        .filter((i) => (i.exch_seg?.toUpperCase() === 'NSE') && (!i.instrumenttype || i.instrumenttype.toUpperCase() === 'EQ' || i.instrumenttype.toUpperCase() === ''))
        .slice(0, limit)
        .map((i) => `${(i.name || i.symbol || '').toUpperCase()}.NS`)
        .filter((s) => /[A-Z]/.test(s));
    return Array.from(new Set(list));
}
async function fetchYahooQuotes(symbols) {
    const key = symbols.join(',');
    const cached = quoteCache.get(key);
    if (cached && Date.now() - cached.t < QUOTE_TTL_MS)
        return cached.data;
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok)
        return [];
    const json = await resp.json();
    const out = (json?.quoteResponse?.result || []).map((q) => ({
        symbol: q?.symbol,
        regularMarketPrice: Number(q?.regularMarketPrice ?? 0),
        regularMarketChange: Number(q?.regularMarketChange ?? 0),
        regularMarketChangePercent: Number(q?.regularMarketChangePercent ?? 0),
        regularMarketVolume: Number(q?.regularMarketVolume ?? 0),
    }));
    quoteCache.set(key, { data: out, t: Date.now() });
    return out;
}
async function fetchYahooChange(symbol, range) {
    const cacheKey = `${symbol}:${range}`;
    const cached = performerCache.get(cacheKey);
    if (cached && Date.now() - cached.t < PERFORMER_TTL_MS)
        return cached.data;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok)
        return null;
    const json = await resp.json();
    const close = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(close) || close.length < 2)
        return null;
    const first = close.find((n) => typeof n === 'number');
    const last = [...close].reverse().find((n) => typeof n === 'number');
    if (typeof first !== 'number' || typeof last !== 'number')
        return null;
    const pct = ((last - first) / first) * 100;
    performerCache.set(cacheKey, { data: [pct], t: Date.now() });
    return pct;
}
router.get('/discovery', async (req, res) => {
    try {
        const instruments = await getInstrumentMaster();
        const symbols = toYahooSymbols(instruments);
        const chunks = [];
        for (let i = 0; i < symbols.length; i += 30)
            chunks.push(symbols.slice(i, i + 30));
        let quotes = [];
        for (const c of chunks) {
            const part = await fetchYahooQuotes(c);
            quotes = quotes.concat(part);
        }
        const mostBought = [...quotes].sort((a, b) => (b.regularMarketVolume || 0) - (a.regularMarketVolume || 0)).slice(0, 8);
        const topGainers = [...quotes].sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent).slice(0, 8);
        const topLosers = [...quotes].sort((a, b) => a.regularMarketChangePercent - b.regularMarketChangePercent).slice(0, 8);
        const under50 = quotes.filter((q) => q.regularMarketPrice < 50).slice(0, 8);
        const under100 = quotes.filter((q) => q.regularMarketPrice < 100).slice(0, 8);
        const under200 = quotes.filter((q) => q.regularMarketPrice < 200).slice(0, 8);
        res.json({
            mostBought,
            topGainers,
            topLosers,
            pocketFriendly: { under50, under100, under200 },
        });
    }
    catch (e) {
        res.status(500).json({ error: 'failed_to_fetch_discovery' });
    }
});
router.get('/performers', async (req, res) => {
    try {
        const tf = String(req.query.tf || '1M');
        const rangeMap = { '1W': '5d', '1M': '1mo', '1Y': '1y', '5Y': '5y' };
        const range = rangeMap[tf] || '1mo';
        const instruments = await getInstrumentMaster();
        const symbols = toYahooSymbols(instruments, 30);
        const results = [];
        for (const s of symbols) {
            const pct = await fetchYahooChange(s, range);
            if (pct === null)
                continue;
            const quotes = await fetchYahooQuotes([s]);
            if (!quotes.length)
                continue;
            results.push({ symbol: s, price: quotes[0].regularMarketPrice, changePct: pct });
            if (results.length >= 8)
                break;
        }
        res.json({ performers: results.sort((a, b) => b.changePct - a.changePct).slice(0, 8) });
    }
    catch (e) {
        res.status(500).json({ error: 'failed_to_fetch_performers' });
    }
});
exports.default = router;
//# sourceMappingURL=market.js.map