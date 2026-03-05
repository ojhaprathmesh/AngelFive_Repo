/**
 * SWR (Stale-While-Revalidate) Cache Service
 *
 * Strategy:
 *  - Serve stale cached data immediately on every request (fast response)
 *  - If the data is past its TTL, trigger a background revalidation
 *  - Next request will get the freshly revalidated data
 *
 * Usage:
 *   const cache = SWRCache.getInstance();
 *   const data = await cache.get("performers:1M", () => fetchPerformers("1M"), 60_000);
 */

type FetchFn<T> = () => Promise<T>;

interface CacheEntry<T> {
    data: T;
    fetchedAt: number;
    ttl: number;
    revalidating: boolean;
}

class SWRCacheService {
    private static instance: SWRCacheService;

    private store = new Map<string, CacheEntry<any>>();

    static getInstance(): SWRCacheService {
        if (!SWRCacheService.instance) {
            SWRCacheService.instance = new SWRCacheService();
        }
        return SWRCacheService.instance;
    }

    /**
     * Get data from cache using SWR strategy.
     *
     * @param key       - Unique cache key (e.g. "performers:1M", "candles:NSE:99926000:ONE_DAY")
     * @param fetchFn   - Async function that fetches fresh data from the source
     * @param ttlMs     - Time-to-live in milliseconds before data is considered stale
     * @returns         - Cached (possibly stale) data, or freshly fetched data if cache is cold
     */
    async get<T>(key: string, fetchFn: FetchFn<T>, ttlMs: number): Promise<T> {
        const entry = this.store.get(key) as CacheEntry<T> | undefined;

        // ── COLD CACHE: nothing stored yet → fetch and block ──────────────────
        if (!entry) {
            console.log(`[SWRCache] COLD  | ${key}`);
            const data = await fetchFn();
            this.store.set(key, {
                data,
                fetchedAt: Date.now(),
                ttl: ttlMs,
                revalidating: false,
            });
            return data;
        }

        const age = Date.now() - entry.fetchedAt;
        const isStale = age > entry.ttl;

        // ── HOT CACHE: still fresh → return immediately ────────────────────────
        if (!isStale) {
            console.log(
                `[SWRCache] HIT   | ${key} | age ${(age / 1000).toFixed(1)}s`,
            );
            return entry.data as T;
        }

        // ── STALE CACHE: serve old data, revalidate in background ─────────────
        console.log(
            `[SWRCache] STALE | ${key} | age ${(age / 1000).toFixed(1)}s → revalidating`,
        );

        if (!entry.revalidating) {
            entry.revalidating = true;
            // Fire and forget — do NOT await
            fetchFn()
                .then((freshData) => {
                    this.store.set(key, {
                        data: freshData,
                        fetchedAt: Date.now(),
                        ttl: ttlMs,
                        revalidating: false,
                    });
                    console.log(`[SWRCache] FRESH | ${key} | revalidation complete`);
                })
                .catch((err) => {
                    console.error(
                        `[SWRCache] ERROR | ${key} | revalidation failed:`,
                        err,
                    );
                    // Keep stale data, allow retry on next request
                    entry.revalidating = false;
                });
        }

        return entry.data as T;
    }


    /** Debug: list all keys and their ages */
    status(): Array<{
        key: string;
        ageSeconds: number;
        stale: boolean;
        revalidating: boolean;
    }> {
        const now = Date.now();
        return Array.from(this.store.entries()).map(([key, entry]) => ({
            key,
            ageSeconds: Math.floor((now - entry.fetchedAt) / 1000),
            stale: now - entry.fetchedAt > entry.ttl,
            revalidating: entry.revalidating,
        }));
    }
}

export const swrCache = SWRCacheService.getInstance();

// ─── TTL Constants (ms) ────────────────────────────────────────────────────

export const TTL = {
    /** Live index prices (SENSEX, NIFTY LTP) */
    LIVE_PRICE: 15_000, // 15 seconds

    /** Top Performers list (changes every few minutes) */
    PERFORMERS: 60_000, // 1 minute

    /** Discovery data: most bought, top movers, pocket friendly */
    DISCOVERY: 60_000, // 1 minute

    /** Index overview chart — intraday candles */
    CHART_INTRADAY: 60_000, // 1 minute

    /** Index overview chart — daily/weekly candles (historical bulk) */
    CHART_HISTORICAL: 5 * 60_000, // 5 minutes

    /** NSE instrument master list */
    INSTRUMENT_MASTER: 12 * 60 * 60_000, // 12 hours
};