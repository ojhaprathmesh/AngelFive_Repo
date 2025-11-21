import { authenticator } from "otplib";
import { fetch } from "undici";

type QuoteMode = "FULL" | "OHLC" | "LTP";

interface SmartAPILoginResponse {
  status: boolean;
  message: string;
  errorcode?: string;
  data?: { jwtToken: string; refreshToken: string; feedToken: string };
}

interface SmartAPIQuoteResponse {
  status: boolean;
  message: string;
  errorcode?: string;
  data?: {
    fetched: Array<{
      exchange: string;
      tradingSymbol: string;
      symbolToken: string;
      ltp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      lastTradeQty: number;
      exchFeedTime: string;
      exchTradeTime: string;
      netChange: number;
      percentChange: number;
      avgPrice: number;
      tradeVolume: number;
    }>;
    unfetched: Array<unknown>;
  };
}

interface SmartAPICandleResponse {
  status: boolean;
  message: string;
  errorcode?: string;
  data?: Array<[string, number, number, number, number, number]>;
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
  token?: string;
}

export class MarketService {
  private clientcode: string;
  private password: string;
  private totpSecret: string;
  private apiKey: string;
  private localIP: string;
  private publicIP: string;
  private macAddress: string;
  private jwtToken: string | null = null;
  private tokenExpiry = 0;

  constructor() {
    this.clientcode = process.env.SMARTAPI_CLIENT_CODE || "";
    this.password = process.env.SMARTAPI_PASSWORD || "";
    this.totpSecret = process.env.SMARTAPI_TOTP_SECRET || "";
    this.apiKey = process.env.SMARTAPI_API_KEY || "";
    this.localIP = process.env.SMARTAPI_LOCAL_IP || "127.0.0.1";
    this.publicIP = process.env.SMARTAPI_PUBLIC_IP || "127.0.0.1";
    this.macAddress = process.env.SMARTAPI_MAC_ADDRESS || "00:00:00:00:00:00";
  }

  private async getJwt(): Promise<string> {
    if (this.jwtToken && Date.now() < this.tokenExpiry - 300000) return this.jwtToken;
    const totp = authenticator.generate(this.totpSecret);

    const res = await fetch(
      "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PrivateKey": this.apiKey,
          Accept: "application/json",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": this.localIP,
          "X-ClientPublicIP": this.publicIP,
          "X-MACAddress": this.macAddress,
          "X-UserType": "USER",
        },
        body: JSON.stringify({ clientcode: this.clientcode, password: this.password, totp }),
      }
    );

    if (!res.ok) throw new Error(`Login failed ${res.status}`);
    const data = (await res.json()) as SmartAPILoginResponse;
    if (!data.status || !data.data?.jwtToken) throw new Error(data.message || "Login error");
    this.jwtToken = data.data.jwtToken;
    this.tokenExpiry = Date.now() + 3600000;
    return this.jwtToken;
  }

  async fetchQuotes(exchangeTokens: Record<string, string[]>, mode: QuoteMode = "FULL"): Promise<MarketData[]> {
    const jwt = await this.getJwt();
    const res = await fetch("https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "X-PrivateKey": this.apiKey,
        "X-SourceID": "WEB",
        "X-ClientLocalIP": this.localIP,
        "X-ClientPublicIP": this.publicIP,
        "X-MACAddress": this.macAddress,
        "X-UserType": "USER",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode, exchangeTokens }),
    });
    if (!res.ok) throw new Error(`Quote failed ${res.status}`);
    const data = (await res.json()) as SmartAPIQuoteResponse;
    const fetched = data.data?.fetched || [];
    return fetched.map((q) => ({
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
      token: q.symbolToken,
    }));
  }

  async getCandleData(
    exchange: string,
    symbolToken: string,
    interval: string,
    fromDate: string,
    toDate: string
  ): Promise<Array<[string, number, number, number, number, number]>> {
    const jwt = await this.getJwt();
    const res = await fetch(
      "https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "X-PrivateKey": this.apiKey,
          "X-SourceID": "WEB",
          "X-ClientLocalIP": this.localIP,
          "X-ClientPublicIP": this.publicIP,
          "X-MACAddress": this.macAddress,
          "X-UserType": "USER",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exchange, symboltoken: symbolToken, interval, fromdate: fromDate, todate: toDate }),
      }
    );
    if (!res.ok) throw new Error(`Candles failed ${res.status}`);
    const data = (await res.json()) as SmartAPICandleResponse;
    return data.data || [];
  }
}

export const marketService = new MarketService();