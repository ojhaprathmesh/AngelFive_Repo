/**
 * Market Data Service - FRONTEND CLIENT
 *
 * This module ONLY calls the backend API. It NEVER touches SmartAPI credentials.
 * Architecture: Frontend → Backend → SmartAPI
 *
 * All SmartAPI credentials (JWT, TOTP, API key) stay on the backend.
 */

const API_BASE =
    typeof window !== "undefined"
        ? ""
        : process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

function getApiUrl(path: string): string {
    if (typeof window !== "undefined") {
        return `/api/market${path}`;
    }
    return `${API_BASE}/api/market${path}`;
}

export interface MarketData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    totBuyQuan?: number;
    totSellQuan?: number;
}

interface InstrumentEntry {
    token: string | number;
    symbol?: string;
    name?: string;
    tradingsymbol?: string;
    instrumenttype?: string;
    exch_seg?: string;
}

const INDEX_TOKEN_MAP: Record<string, { exchange: string; token: string }> = {
    "BSE:SENSEX": { exchange: "BSE", token: "99919000" },
    "NSE:NIFTY": { exchange: "NSE", token: "99926000" },
    "NSE:BANKNIFTY": { exchange: "NSE", token: "99926009" },
    "NSE:INDIAVIX": { exchange: "NSE", token: "99926017" },
    "NSE:FINNIFTY": { exchange: "NSE", token: "99926037" },
    "SBIN-EQ": { exchange: "NSE", token: "3045" },
};

class MarketDataService {
    private cache: Map<string, { data: MarketData; timestamp: number }> =
        new Map();
    private cacheTimeout = 60000;
    private refreshIntervals: Map<string, ReturnType<typeof setInterval>> =
        new Map();
    private lastUpdateTimes: Map<string, Date> = new Map();

    private getCachedData(symbol: string): MarketData | null {
        const cached = this.cache.get(symbol);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    private setCachedData(symbol: string, data: MarketData): void {
        this.cache.set(symbol, { data, timestamp: Date.now() });
    }

    private mapQuote(q: any): MarketData {
        return {
            symbol: q.symbol,
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
            lastUpdated: q.lastUpdated,
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume,
            totBuyQuan: q.totBuyQuan,
            totSellQuan: q.totSellQuan,
        };
    }

    public getFallbackData(symbol: string): MarketData {
        const fallbackData: Record<string, MarketData> = {
            "BSE:SENSEX": {
                symbol: "SENSEX",
                price: 81500.0,
                change: 150.25,
                changePercent: 0.18,
                lastUpdated: new Date().toISOString().split("T")[0],
                open: 81350.0,
                high: 81650.0,
                low: 81200.0,
                close: 81500.0,
                volume: 0,
            },
            "NSE:NIFTY": {
                symbol: "NIFTY",
                price: 24800.0,
                change: 45.5,
                changePercent: 0.18,
                lastUpdated: new Date().toISOString().split("T")[0],
                open: 24755.0,
                high: 24850.0,
                low: 24720.0,
                close: 24800.0,
                volume: 0,
            },
            "SBIN-EQ": {
                symbol: "SBIN-EQ",
                price: 825.0,
                change: 12.5,
                changePercent: 1.54,
                lastUpdated: new Date().toISOString().split("T")[0],
                open: 815.0,
                high: 830.0,
                low: 810.0,
                close: 825.0,
                volume: 1250000,
            },
        };

        return (
            fallbackData[symbol] || {
                symbol: symbol.split(":")[1] || symbol,
                price: 1000.0,
                change: 10.0,
                changePercent: 1.0,
                lastUpdated: new Date().toISOString().split("T")[0],
                open: 990.0,
                high: 1020.0,
                low: 985.0,
                close: 1000.0,
                volume: 0,
            }
        );
    }

    public getAllFallbackData(): MarketData[] {
        return [
            this.getFallbackData("BSE:SENSEX"),
            this.getFallbackData("NSE:NIFTY"),
        ];
    }

    async getMarketData(symbol: string): Promise<MarketData> {
        const cachedData = this.getCachedData(symbol);
        if (cachedData) return cachedData;

        try {
            const res = await fetch(getApiUrl("/smartapi/quote"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbols: [symbol] }),
            });
            const json = await res.json();

            if (json.quotes?.length > 0) {
                const quote = json.quotes[0];
                const data = this.mapQuote(quote);
                this.setCachedData(symbol, data);
                return data;
            }
        } catch (err) {
            console.error(`Error fetching market data for ${symbol}:`, err);
        }

        return this.getFallbackData(symbol);
    }

    async getSensexData(): Promise<MarketData> {
        return this.getMarketData("BSE:SENSEX");
    }

    async getNiftyData(): Promise<MarketData> {
        return this.getMarketData("NSE:NIFTY");
    }

    async getBankNiftyData(): Promise<MarketData> {
        return this.getMarketData("NSE:BANKNIFTY");
    }

    async getIndiaVixData(): Promise<MarketData> {
        return this.getMarketData("NSE:INDIAVIX");
    }

    async getFinniftyData(): Promise<MarketData> {
        return this.getMarketData("NSE:FINNIFTY");
    }

    async getSBINData(): Promise<MarketData> {
        return this.getMarketData("SBIN-EQ");
    }

    async getSymbolToken(
        symbol: string,
    ): Promise<{ exchange: string; token: string } | null> {
        if (INDEX_TOKEN_MAP[symbol]) return INDEX_TOKEN_MAP[symbol];

        try {
            const params = new URLSearchParams({ symbol, exchange: "NSE" });
            const res = await fetch(getApiUrl(`/symbol-token?${params}`));
            if (!res.ok) return null;
            const json = await res.json();
            if (json.token && json.exchange) {
                return { exchange: json.exchange, token: String(json.token) };
            }
        } catch {
            // Fallback: try instrument master (public URL, no credentials)
            try {
                const resp = await fetch(
                    "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json",
                );
                if (resp.ok) {
                    const instruments: InstrumentEntry[] = await resp.json();
                    const upper = symbol.toUpperCase();
                    const found = instruments.find((i) => {
                        const candidates = [
                            i.symbol?.toUpperCase(),
                            i.name?.toUpperCase(),
                            i.tradingsymbol?.toUpperCase(),
                        ];
                        return candidates.some(
                            (c) =>
                                c === upper ||
                                c === `${upper}-EQ` ||
                                c?.startsWith(`${upper}-`),
                        );
                    });
                    if (found?.token) {
                        return {
                            exchange: found.exch_seg?.toUpperCase() || "NSE",
                            token: String(found.token),
                        };
                    }
                }
            } catch {
            }
        }
        return null;
    }

    async getQuotesByTokens(
        exchange: string,
        tokens: string[],
    ): Promise<MarketData[]> {
        if (tokens.length === 0) return [];

        try {
            const exchangeTokens = { [exchange]: tokens };
            const res = await fetch(getApiUrl("/smartapi/quote"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exchangeTokens }),
            });
            const json = await res.json();

            if (json.quotes?.length > 0) {
                return json.quotes.map((q: any) => this.mapQuote(q));
            }
        } catch (err) {
            console.error("Error fetching quotes by tokens:", err);
        }
        return [];
    }

    async getCandleData(
        exchange: string,
        symbolToken: string,
        interval: string,
        fromDate: string,
        toDate: string,
    ): Promise<Array<[string, number, number, number, number, number]>> {
        try {
            const params = new URLSearchParams({
                exchange,
                token: symbolToken,
                interval,
                from: fromDate,
                to: toDate,
            });
            const res = await fetch(getApiUrl(`/smartapi/candles?${params}`));
            const json = await res.json();

            if (Array.isArray(json.candles) && json.candles.length > 0) {
                return json.candles;
            }
        } catch (err) {
            console.error("Error fetching candle data:", err);
        }
        return [];
    }

    async getMultipleQuotes(symbols: string[]): Promise<MarketData[]> {
        if (symbols.length === 0) return [];

        try {
            const res = await fetch(getApiUrl("/smartapi/quote"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbols }),
            });
            const json = await res.json();

            if (json.quotes?.length > 0) {
                return json.quotes.map((q: any) => this.mapQuote(q));
            }
        } catch (err) {
            console.error("Error fetching multiple quotes:", err);
        }

        return symbols.map((s) => this.getFallbackData(s));
    }

    async getMarketDataWithStatus(symbol: string): Promise<{
        data: MarketData | null;
        isLoading: boolean;
        error: string | null;
        lastUpdated: Date | null;
    }> {
        try {
            const data = await this.getMarketData(symbol);
            this.lastUpdateTimes.set(symbol, new Date());
            return {
                data,
                isLoading: false,
                error: null,
                lastUpdated: this.lastUpdateTimes.get(symbol) || null,
            };
        } catch (err) {
            const fallbackData = this.getFallbackData(symbol);
            return {
                data: fallbackData,
                isLoading: false,
                error: err instanceof Error ? err.message : "Unknown error",
                lastUpdated: this.lastUpdateTimes.get(symbol) || null,
            };
        }
    }

    async getAllMarketDataWithStatus(): Promise<{
        sensex: {
            data: MarketData | null;
            isLoading: boolean;
            error: string | null;
            lastUpdated: Date | null;
        };
        nifty: {
            data: MarketData | null;
            isLoading: boolean;
            error: string | null;
            lastUpdated: Date | null;
        };
    }> {
        try {
            const [sensex, nifty] = await Promise.all([
                this.getMarketDataWithStatus("BSE:SENSEX"),
                this.getMarketDataWithStatus("NSE:NIFTY"),
            ]);
            return { sensex, nifty };
        } catch {
            return {
                sensex: {
                    data: null,
                    isLoading: false,
                    error: "Failed to fetch SENSEX data",
                    lastUpdated: this.lastUpdateTimes.get("BSE:SENSEX") || null,
                },
                nifty: {
                    data: null,
                    isLoading: false,
                    error: "Failed to fetch NIFTY data",
                    lastUpdated: this.lastUpdateTimes.get("NSE:NIFTY") || null,
                },
            };
        }
    }

    startAutoRefresh(
        symbol: string,
        intervalMs: number = 60000,
        onUpdate?: (data: MarketData | null, error?: string) => void,
    ): void {
        this.stopAutoRefresh(symbol);
        const safeIntervalMs = Math.max(intervalMs, 10000);
        const interval = setInterval(async () => {
            try {
                const result = await this.getMarketDataWithStatus(symbol);
                onUpdate?.(result.data, result.error || undefined);
            } catch (err) {
                const fallbackData = this.getFallbackData(symbol);
                onUpdate?.(
                    fallbackData,
                    err instanceof Error ? err.message : "Unknown error",
                );
            }
        }, safeIntervalMs);
        this.refreshIntervals.set(symbol, interval);
    }

    stopAutoRefresh(symbol: string): void {
        const interval = this.refreshIntervals.get(symbol);
        if (interval) {
            clearInterval(interval);
            this.refreshIntervals.delete(symbol);
        }
    }

    stopAllAutoRefresh(): void {
        this.refreshIntervals.forEach((interval) => clearInterval(interval));
        this.refreshIntervals.clear();
    }

    getLastUpdateTime(symbol: string): Date | null {
        return this.lastUpdateTimes.get(symbol) || null;
    }

    isDataFresh(lastUpdated: Date | null, maxAgeMs: number = 60000): boolean {
        if (!lastUpdated) return false;
        return Date.now() - lastUpdated.getTime() < maxAgeMs;
    }

    formatPrice(price: number): string {
        return new Intl.NumberFormat("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(price);
    }

    formatChange(change: number, changePercent: number): string {
        const sign = change >= 0 ? "+" : "";
        const formattedChange = this.formatPrice(Math.abs(change));
        const formattedPercent = Math.abs(changePercent).toFixed(2);
        return `${sign}${formattedChange} (${sign}${formattedPercent}%)`;
    }
}

export const marketDataService = new MarketDataService();
