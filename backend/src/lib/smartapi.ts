/**
 * SmartAPI Market Data Proxy Service
 *
 * Security & Architectural Scope:
 * - Read-Only Market Data Scope: This service is strictly an institutional market-data
 *   proxy for quotes, candles, and scrip resolution.
 * - Non-Trading Invariant: No trading, order execution, or user-specific broker mutation
 *   endpoints are exposed or handled through this shared broker session.
 * - Single-Session Management: Uses an in-flight promise singleton (`jwtLoginInFlight`)
 *   and rate-limit backoff cooldowns to protect the upstream broker API.
 */

import speakeasy from "speakeasy";

import { ENV } from "../config/env";
import { logger } from "./logger";

let jwtTokenCache: string | null = null;
let jwtTokenExpiry = 0;

/** One in-flight login shared by all callers (avoids Angel One rate limits on parallel logins). */
let jwtLoginInFlight: Promise<string | null> | null = null;

/** After broker returns 403 rate limit, do not attempt login again until this instant. */
let loginBackoffUntilMs = 0;

const LOGIN_RATE_LIMIT_BACKOFF_MS = 120_000;

/* ---------------------------------- */
/* TOTP Generator                     */
/* ---------------------------------- */

function generateTOTP(secret: string): string {
  return (speakeasy.totp as any)({ secret, encoding: "base32", window: 1 });
}

/* ---------------------------------- */
/* JWT TOKEN                          */
/* ---------------------------------- */

async function loginOnce(): Promise<string | null> {
  try {
    const totp = generateTOTP(ENV.SMARTAPI_TOTP_SECRET);

    const response = await fetch(
      "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PrivateKey": ENV.SMARTAPI_API_KEY,
          Accept: "application/json",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": ENV.SMARTAPI_LOCAL_IP,
          "X-ClientPublicIP": ENV.SMARTAPI_PUBLIC_IP,
          "X-MACAddress": ENV.SMARTAPI_MAC_ADDRESS,
          "X-UserType": "USER",
        },
        body: JSON.stringify({
          clientcode: ENV.SMARTAPI_CLIENT_CODE,
          password: ENV.SMARTAPI_PASSWORD,
          totp,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const rateLimited =
        response.status === 403 &&
        /exceeding access rate|rate limit/i.test(errText);
      if (rateLimited) {
        loginBackoffUntilMs = Date.now() + LOGIN_RATE_LIMIT_BACKOFF_MS;
        logger.warn(
          { backoffMs: LOGIN_RATE_LIMIT_BACKOFF_MS },
          "[SmartAPI] Login rate-limited — backing off duplicate login attempts",
        );
      } else {
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            error: errText.slice(0, 500),
          },
          "[SmartAPI] Login HTTP error:",
        );
      }
      return null;
    }

    const data: any = await response.json();

    if (!data.status || !data.data?.jwtToken) {
      logger.error("[SmartAPI] Login failed:", data.message, data.errorCode);
      return null;
    }

    jwtTokenCache = data.data.jwtToken;
    jwtTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
    loginBackoffUntilMs = 0;

    return jwtTokenCache;
  } catch (error) {
    jwtTokenCache = null;
    jwtTokenExpiry = 0;
    logger.error({ err: error }, "SmartAPI login failed:");
    return null;
  }
}

export async function getSmartApiJwtToken(): Promise<string | null> {
  const now = Date.now();

  // Use cached token (5 min buffer before expiry)
  if (jwtTokenCache && now < jwtTokenExpiry - 5 * 60 * 1000) {
    return jwtTokenCache;
  }

  if (now < loginBackoffUntilMs) {
    logger.warn(
      { retryAfterMs: loginBackoffUntilMs - now },
      "[SmartAPI] Login skipped during broker rate-limit cooldown",
    );
    return jwtTokenCache && now < jwtTokenExpiry ? jwtTokenCache : null;
  }

  if (!jwtLoginInFlight) {
    jwtLoginInFlight = loginOnce().finally(() => {
      jwtLoginInFlight = null;
    });
  }

  return jwtLoginInFlight;
}

/* ---------------------------------- */
/* Credential Check                   */
/* ---------------------------------- */

export function hasSmartApiCredentials(): boolean {
  return !!(
    ENV.SMARTAPI_API_KEY &&
    ENV.SMARTAPI_CLIENT_CODE &&
    ENV.SMARTAPI_PASSWORD &&
    ENV.SMARTAPI_TOTP_SECRET
  );
}

/* ---------------------------------- */
/* QUOTES                             */
/* ---------------------------------- */

export interface SmartApiQuoteItem {
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

let quoteFetchQueue = Promise.resolve();
const QUOTE_INTERVAL_MS = 105; // ~10 RPS

function queueQuoteFetch<T>(fn: () => Promise<T>): Promise<T> {
  const next = quoteFetchQueue.then(
    () => new Promise<void>((res) => setTimeout(res, QUOTE_INTERVAL_MS)),
  );
  quoteFetchQueue = next.catch(() => {});
  return next.then(() => fn());
}

export async function fetchSmartApiQuotes(
  exchangeTokens: Record<string, string[]>,
): Promise<SmartApiQuoteItem[]> {
  const jwt = await getSmartApiJwtToken();
  if (!jwt) return [];

  return queueQuoteFetch(async () => {
    const start = Date.now();
    try {
      const response = await fetch(
        "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "X-PrivateKey": ENV.SMARTAPI_API_KEY,
            "X-SourceID": "WEB",
            "X-ClientLocalIP": ENV.SMARTAPI_LOCAL_IP,
            "X-ClientPublicIP": ENV.SMARTAPI_PUBLIC_IP,
            "X-MACAddress": ENV.SMARTAPI_MAC_ADDRESS,
            "X-UserType": "USER",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "FULL",
            exchangeTokens,
          }),
        },
      );

      const durationMs = Date.now() - start;

      if (!response.ok) {
        logger.warn(
          { status: response.status, durationMs },
          "[SmartAPI] Quote fetch HTTP error",
        );
        return [];
      }

      const data: any = await response.json();
      if (!data.status || !data.data?.fetched) {
        logger.warn(
          { durationMs, message: data?.message },
          "[SmartAPI] Quote fetch returned no data",
        );
        return [];
      }

      const quotes = data.data.fetched.map((q: any) => ({
        symbol: q.tradingSymbol,
        price: q.ltp,
        change: q.netChange,
        changePercent: q.percentChange,
        lastUpdated: q.exchFeedTime,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.tradeVolume,
        totBuyQuan: q.totBuyQuan,
        totSellQuan: q.totSellQuan,
      }));

      logger.info(
        { durationMs, count: quotes.length },
        "[SmartAPI] Quote fetch OK",
      );
      return quotes;
    } catch (error) {
      logger.error(
        { err: error, durationMs: Date.now() - start },
        "[SmartAPI] Quote fetch failed",
      );
      return [];
    }
  });
}

/* ---------------------------------- */
/* CANDLES                            */
/* ---------------------------------- */

let candleFetchQueue = Promise.resolve();
const CANDLE_INTERVAL_MS = 350; // ~3 RPS

function queueCandleFetch<T>(fn: () => Promise<T>): Promise<T> {
  const next = candleFetchQueue.then(
    () => new Promise<void>((res) => setTimeout(res, CANDLE_INTERVAL_MS)),
  );
  candleFetchQueue = next.catch(() => {});
  return next.then(() => fn());
}

export async function fetchSmartApiCandles(
  exchange: string,
  symbolToken: string,
  interval: string,
  fromDate: string,
  toDate: string,
): Promise<Array<[string, number, number, number, number, number]>> {
  const jwt = await getSmartApiJwtToken();
  if (!jwt) return [];

  return queueCandleFetch(async () => {
    const start = Date.now();
    try {
      const response = await fetch(
        "https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "X-PrivateKey": ENV.SMARTAPI_API_KEY,
            "X-SourceID": "WEB",
            "X-ClientLocalIP": ENV.SMARTAPI_LOCAL_IP,
            "X-ClientPublicIP": ENV.SMARTAPI_PUBLIC_IP,
            "X-MACAddress": ENV.SMARTAPI_MAC_ADDRESS,
            "X-UserType": "USER",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exchange,
            symboltoken: symbolToken,
            interval,
            fromdate: fromDate,
            todate: toDate,
          }),
        },
      );

      const durationMs = Date.now() - start;

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            error: errText.slice(0, 500),
            durationMs,
          },
          "[SmartAPI] Candle fetch HTTP error",
        );
        return [];
      }

      const data: any = await response.json();
      if (!data.status || !Array.isArray(data.data)) {
        logger.error(
          {
            payload: {
              status: data?.status,
              message: data?.message,
              errorCode: data?.errorCode,
            },
            durationMs,
          },
          "[SmartAPI] Candle fetch returned invalid payload",
        );
        return [];
      }

      logger.info(
        { durationMs, count: data.data.length, exchange, symbolToken },
        "[SmartAPI] Candle fetch OK",
      );
      return data.data;
    } catch (error) {
      logger.error(
        { err: error, durationMs: Date.now() - start },
        "[SmartAPI] Candle fetch failed",
      );
      return [];
    }
  });
}
