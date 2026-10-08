/**
 * SWR (Stale-While-Revalidate) Cache Service — Redis-backed
 *
 * Strategy:
 *  - Serve stale cached data immediately on every request (fast response)
 *  - If the data is past its TTL, trigger a background revalidation
 *  - Next request will get the freshly revalidated data
 *
 * Resilience:
 *  - Redis is treated as an optimisation layer, NOT a hard dependency
 *  - Any Redis failure falls back to a process-local in-memory Map
 *  - Cache errors NEVER crash requests — they are silently swallowed
 *
 * Logging:
 *  [CACHE] HIT   market:discovery           — served from cache (hot)
 *  [CACHE] STALE market:discovery           — served stale, revalidating
 *  [CACHE] MISS  market:discovery           — cold cache, fetching
 *  [CACHE] SET   market:discovery ttl=60s   — stored to Redis
 *  [CACHE] DEL   market:discovery           — deleted from Redis
 *  [CACHE] CLR   market:*  count=3          — pattern cleared
 *  [CACHE] ERROR <key> <message>            — Redis unavailable, using fallback
 *
 * Usage:
 *   const data = await swrCache.get("market:discovery", fetchDiscovery, TTL.DISCOVERY);
 */

import { logger } from "../lib/logger";
import { getRedisClient, getRedisStatus } from "../lib/redis";

type FetchFn<T> = () => Promise<T>;

// ── In-memory fallback store ──────────────────────────────────────────────────

interface MemEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number; // ms
  revalidating: boolean;
}

const memStore = new Map<string, MemEntry<any>>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(
  tag: "HIT" | "STALE" | "MISS" | "SET" | "DEL" | "CLR" | "ERROR",
  key: string,
  extra = "",
): void {
  logger.debug({ key, tag, extra }, `[CACHE] ${tag.padEnd(5)}`);
}

function isRedisAvailable(): boolean {
  return getRedisStatus().status === "connected";
}

// ── Redis helpers (all catch-safe) ────────────────────────────────────────────

async function redisGet<T>(
  key: string,
): Promise<{ data: T; fetchedAt: number; ttl: number } | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as { data: T; fetchedAt: number; ttl: number };
  } catch {
    return null;
  }
}

async function redisSet<T>(
  key: string,
  value: { data: T; fetchedAt: number; ttl: number },
  ttlMs: number,
): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) {
      log("ERROR", key, "redis disabled");
      return;
    }
    const ttlSec = Math.ceil(ttlMs / 1000);
    await client.set(key, JSON.stringify(value), "EX", ttlSec);
    log("SET", key, `ttl=${ttlSec}s`);
  } catch (err: any) {
    log("ERROR", key, err?.message ?? "redis set failed");
  }
}

async function redisDel(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;
    const count = await client.del(key);
    return count > 0;
  } catch {
    return false;
  }
}

async function redisScan(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  try {
    const client = getRedisClient();
    if (!client) return keys;
    let cursor = "0";
    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== "0");
  } catch {
    // ignore — pattern delete degrades gracefully
  }
  return keys;
}

// ── SWR Cache Service ─────────────────────────────────────────────────────────

class SWRCacheService {
  private static instance: SWRCacheService;
  private inflight = new Map<string, Promise<any>>();

  static getInstance(): SWRCacheService {
    if (!SWRCacheService.instance) {
      SWRCacheService.instance = new SWRCacheService();
    }
    return SWRCacheService.instance;
  }

  /**
   * Get data using SWR strategy — Redis primary, in-memory fallback.
   *
   * @param key     Namespaced cache key (e.g. "market:discovery")
   * @param fetchFn Async supplier for fresh data
   * @param ttlMs   Time-to-live in milliseconds
   */
  async get<T>(key: string, fetchFn: FetchFn<T>, ttlMs: number): Promise<T> {
    const useRedis = isRedisAvailable();

    // ── Try to load entry ────────────────────────────────────────────────────
    let fetchedAt: number | undefined;
    let data: T | undefined;
    let isStale = true;
    let revalidating = false;

    if (useRedis) {
      const entry = await redisGet<T>(key);
      if (entry) {
        fetchedAt = entry.fetchedAt;
        data = entry.data;
        isStale = Date.now() - entry.fetchedAt > entry.ttl;
      }
    } else {
      // Fallback to in-memory
      const entry = memStore.get(key) as MemEntry<T> | undefined;
      if (entry) {
        fetchedAt = entry.fetchedAt;
        data = entry.data;
        isStale = Date.now() - entry.fetchedAt > entry.ttl;
        revalidating = entry.revalidating;
      }
    }

    // ── COLD CACHE (Single-Flight Stampede Protection) ───────────────────────
    if (data === undefined) {
      const existing = this.inflight.get(key);
      if (existing) {
        return existing as Promise<T>;
      }

      log("MISS", key);
      const promise = (async () => {
        try {
          const fresh = await fetchFn();
          await this._store(key, fresh, ttlMs, useRedis);
          return fresh;
        } finally {
          this.inflight.delete(key);
        }
      })();

      this.inflight.set(key, promise);
      return promise;
    }

    const ageSec =
      fetchedAt !== undefined
        ? ((Date.now() - fetchedAt) / 1000).toFixed(1)
        : "?";

    // ── HOT CACHE ─────────────────────────────────────────────────────────────
    if (!isStale) {
      log("HIT", key, `age=${ageSec}s`);
      return data;
    }

    // ── STALE — serve immediately, revalidate in background ───────────────────
    log("STALE", key, `age=${ageSec}s → revalidating`);

    if (!revalidating) {
      // Mark revalidating in mem store (Redis has no native revalidating flag)
      if (!useRedis) {
        const mem = memStore.get(key);
        if (mem) mem.revalidating = true;
      }

      // Fire-and-forget — do NOT await
      fetchFn()
        .then((fresh) => this._store(key, fresh, ttlMs, useRedis))
        .catch((err) => {
          logger.error({ key, err }, `[CACHE] revalidation failed`);
          // Allow retry on next request
          if (!useRedis) {
            const mem = memStore.get(key);
            if (mem) mem.revalidating = false;
          }
        });
    }

    return data;
  }

  /** Delete a single key from both Redis and memory */
  async delete(key: string): Promise<boolean> {
    log("DEL", key);
    const [redisDeleted, memDeleted] = await Promise.all([
      redisDel(key),
      Promise.resolve(memStore.delete(key)),
    ]);
    return redisDeleted || memDeleted;
  }

  /**
   * Clear entries by prefix (pattern) or everything.
   *
   * @param prefix If provided, only keys starting with this prefix are removed.
   *               Supports Redis SCAN glob: e.g. "market:*"
   */
  async clear(prefix?: string): Promise<number> {
    const pattern = prefix ? `${prefix}*` : "*";
    let count = 0;

    // Redis
    const redisKeys = await redisScan(pattern);
    if (redisKeys.length > 0) {
      try {
        const client = getRedisClient();
        if (client) count += await client.del(...redisKeys);
      } catch {
        // ignore
      }
    }

    // In-memory (always clean up)
    if (!prefix) {
      count += memStore.size;
      memStore.clear();
    } else {
      for (const k of memStore.keys()) {
        if (k.startsWith(prefix)) {
          memStore.delete(k);
          count++;
        }
      }
    }

    log("CLR", prefix ?? "*", `count=${count}`);
    return count;
  }

  /** List all currently known cache entries (mem store + approximate Redis info) */
  status(): Array<{
    key: string;
    ageSeconds: number;
    stale: boolean;
    revalidating: boolean;
    backend: "redis" | "memory";
  }> {
    const now = Date.now();
    // We can only introspect memory store synchronously; Redis is async so
    // status() reports what the local process knows about
    return Array.from(memStore.entries()).map(([key, entry]) => ({
      key,
      ageSeconds: Math.floor((now - entry.fetchedAt) / 1000),
      stale: now - entry.fetchedAt > entry.ttl,
      revalidating: entry.revalidating,
      backend: "memory" as const,
    }));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _store<T>(
    key: string,
    data: T,
    ttlMs: number,
    useRedis: boolean,
  ): Promise<void> {
    const payload = { data, fetchedAt: Date.now(), ttl: ttlMs };

    if (useRedis) {
      await redisSet(key, payload, ttlMs);
      // Mirror a lightweight entry in mem so status() has something to show
      memStore.set(key, { ...payload, revalidating: false });
    } else {
      // Error-log only first time Redis was expected but unavailable
      log("ERROR", key, "redis unavailable — stored in memory");
      memStore.set(key, { ...payload, revalidating: false });
    }
  }
}

export const swrCache = SWRCacheService.getInstance();

// ─── TTL Constants (ms) ────────────────────────────────────────────────────────

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
