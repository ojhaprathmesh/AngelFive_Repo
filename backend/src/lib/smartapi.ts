/**
 * SmartAPI service - BACKEND ONLY.
 * NEVER import this in frontend/client code.
 * Credentials stay on server; frontend calls /api/market/* endpoints.
 */

let authenticator: any = null;
try {
  const otplib = require("otplib");
  authenticator = otplib.authenticator;
} catch {
  console.warn("otplib not installed. SmartAPI JWT generation may fail.");
}

let jwtTokenCache: string | null = null;
let jwtTokenExpiry: number = 0;

function generateTOTP(secret: string): string {
  if (!authenticator) {
    throw new Error("otplib not installed. Run: npm install otplib");
  }
  return authenticator.generate(secret);
}

export async function getSmartApiJwtToken(): Promise<string | null> {
  if (jwtTokenCache && Date.now() < jwtTokenExpiry - 300000) {
    return jwtTokenCache;
  }

  const apiKey = process.env.SMARTAPI_API_KEY;
  const clientCode = process.env.SMARTAPI_CLIENT_CODE;
  const password = process.env.SMARTAPI_PASSWORD;
  const totpSecret = process.env.SMARTAPI_TOTP_SECRET;
  const localIp = process.env.SMARTAPI_LOCAL_IP || "127.0.0.1";
  const publicIp = process.env.SMARTAPI_PUBLIC_IP || "127.0.0.1";
  const mac = process.env.SMARTAPI_MAC_ADDRESS || "00:00:00:00:00:00";

  if (!apiKey || !clientCode || !password || !totpSecret) {
    return null;
  }

  try {
    const totp = generateTOTP(totpSecret);
    const response = await fetch(
      "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PrivateKey": apiKey,
          Accept: "application/json",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": localIp,
          "X-ClientPublicIP": publicIp,
          "X-MACAddress": mac,
          "X-UserType": "USER",
        },
        body: JSON.stringify({
          clientcode: clientCode,
          password,
          totp,
        }),
      },
    );

    if (!response.ok) return null;
    const data: any = await response.json();
    if (!data.status || !data.data?.jwtToken) return null;

    jwtTokenCache = data.data.jwtToken;
    jwtTokenExpiry = Date.now() + 3600000;
    return jwtTokenCache;
  } catch {
    jwtTokenCache = null;
    jwtTokenExpiry = 0;
    return null;
  }
}

export function hasSmartApiCredentials(): boolean {
  return !!(
    process.env.SMARTAPI_API_KEY &&
    process.env.SMARTAPI_CLIENT_CODE &&
    process.env.SMARTAPI_PASSWORD &&
    process.env.SMARTAPI_TOTP_SECRET
  );
}

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

export async function fetchSmartApiQuotes(
  exchangeTokens: Record<string, string[]>,
): Promise<SmartApiQuoteItem[]> {
  const jwt = await getSmartApiJwtToken();
  if (!jwt) return [];

  const apiKey = process.env.SMARTAPI_API_KEY!;
  const localIp = process.env.SMARTAPI_LOCAL_IP || "127.0.0.1";
  const publicIp = process.env.SMARTAPI_PUBLIC_IP || "127.0.0.1";
  const mac = process.env.SMARTAPI_MAC_ADDRESS || "00:00:00:00:00:00";

  try {
    const response = await fetch(
      "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "X-PrivateKey": apiKey,
          "X-SourceID": "WEB",
          "X-ClientLocalIP": localIp,
          "X-ClientPublicIP": publicIp,
          "X-MACAddress": mac,
          "X-UserType": "USER",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "FULL",
          exchangeTokens,
        }),
      },
    );

    if (!response.ok) return [];
    const data: any = await response.json();
    if (!data.status || !data.data?.fetched) return [];

    return data.data.fetched.map((q: any) => ({
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
  } catch {
    return [];
  }
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

  const apiKey = process.env.SMARTAPI_API_KEY!;
  const localIp = process.env.SMARTAPI_LOCAL_IP || "127.0.0.1";
  const publicIp = process.env.SMARTAPI_PUBLIC_IP || "127.0.0.1";
  const mac = process.env.SMARTAPI_MAC_ADDRESS || "00:00:00:00:00:00";

  try {
    const response = await fetch(
      "https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "X-PrivateKey": apiKey,
          "X-SourceID": "WEB",
          "X-ClientLocalIP": localIp,
          "X-ClientPublicIP": publicIp,
          "X-MACAddress": mac,
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

    if (!response.ok) return [];
    const data: any = await response.json();
    if (!data.status || !Array.isArray(data.data)) return [];
    return data.data;
  } catch {
    return [];
  }
}
