import useSWR from "swr";

// ─── Generic fetcher ──────────────────────────────────────────────────────────

const fetcher = (url: string) =>
    fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    });

// ─── TTL constants (ms) — mirror backend/src/services/cache.ts ───────────────

const TTL = {
    PERFORMERS: 60_000, // 1 min
    DISCOVERY: 60_000, // 1 min
    CHART_INTRADAY: 60_000, // 1 min
    CHART_HISTORICAL: 5 * 60_000, // 5 min
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type PerfTimeframe = "1W" | "1M" | "1Y" | "5Y";

export interface Performer {
    symbol: string;
    price: number;
    changePct: number;
}

export interface Candle {
    time: number; // unix timestamp (seconds)
    open: number;
    high: number;
    low: number;
    close: number;
}

// ─── useTopPerformers ─────────────────────────────────────────────────────────

/**
 * Replaces the manual fetch in market-discovery.tsx and view-all/page.tsx
 */
export function useTopPerformers(tf: PerfTimeframe = "1M") {
    const { data, error, isLoading, isValidating } = useSWR<{
        performers: Performer[];
    }>(`/api/market/performers?tf=${tf}`, fetcher, {
        refreshInterval: TTL.PERFORMERS,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 15_000,
        keepPreviousData: true,
    });

    return {
        performers: data?.performers ?? [],
        isLoading,
        isValidating,
        error: error?.message ?? null,
    };
}

// ─── useDiscovery ─────────────────────────────────────────────────────────────

/**
 * Replaces the manual fetch for /api/market/discovery
 * (most-bought, top-movers, pocket-friendly)
 */
export function useDiscovery() {
    const { data, error, isLoading, isValidating } = useSWR(
        "/api/market/discovery",
        fetcher,
        {
            refreshInterval: TTL.DISCOVERY,
            revalidateOnFocus: true,
            dedupingInterval: 20_000,
            keepPreviousData: true,
        },
    );

    return {
        mostBought: data?.mostBought ?? [],
        topGainers: data?.topGainers ?? [],
        topLosers: data?.topLosers ?? [],
        pocketFriendly: data?.pocketFriendly ?? {},
        isLoading,
        isValidating,
        error: error?.message ?? null,
    };
}

// ─── useIndexChart ────────────────────────────────────────────────────────────

type ChartTimeframe = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y" | "Max";

/**
 * Replaces the manual SmartAPI candle fetch in trading-chart.tsx
 *
 * The hook selects the right TTL based on whether it's an intraday view.
 * `null` key pauses fetching (e.g. when token isn't loaded yet).
 */
export function useIndexChart(params: {
    exchange: string | null;
    symboltoken: string | null;
    interval: string | null;
    fromdate: string | null;
    todate: string | null;
    timeFrame: ChartTimeframe;
}) {
    const { exchange, symboltoken, interval, fromdate, todate, timeFrame } =
        params;

    // Build stable string key — null if any param is missing (pauses SWR)
    const key =
        exchange && symboltoken && interval && fromdate && todate
            ? `/api/market/smartapi/candles?exchange=${exchange}&token=${symboltoken}&interval=${interval}&from=${encodeURIComponent(fromdate)}&to=${encodeURIComponent(todate)}`
            : null;

    // Intraday frames get shorter TTL
    const intradayFrames: ChartTimeframe[] = ["1D", "5D"];
    const ttl = intradayFrames.includes(timeFrame)
        ? TTL.CHART_INTRADAY
        : TTL.CHART_HISTORICAL;

    const { data, error, isLoading, isValidating } = useSWR<{
        candles: Candle[];
    }>(key, fetcher, {
        refreshInterval: ttl,
        revalidateOnFocus: timeFrame === "1D", // only auto-revalidate on focus for intraday
        dedupingInterval: 20_000,
        keepPreviousData: true,
    });

    return {
        candles: data?.candles ?? [],
        isLoading,
        isValidating,
        error: error?.message ?? null,
    };
}
