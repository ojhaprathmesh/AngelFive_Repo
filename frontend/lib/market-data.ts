import { authenticator } from "otplib";

interface MarketData {
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
}

interface SmartAPIQuoteResponse {
  status: boolean;
  message: string;
  errorcode: string;
  data: {
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
      opnInterest: number;
      lowerCircuit: number;
      upperCircuit: number;
      totBuyQuan: number;
      totSellQuan: number;
      "52WeekLow": number;
      "52WeekHigh": number;
      depth?: {
        buy: Array<{ price: number; quantity: number; orders: number }>;
        sell: Array<{ price: number; quantity: number; orders: number }>;
      };
    }>;
    unfetched: Array<unknown>;
  };
}

interface SmartAPICandleResponse {
  status: boolean;
  message: string;
  errorcode: string;
  data: Array<[string, number, number, number, number, number]>; // [timestamp, open, high, low, close, volume]
}

interface SmartAPILoginResponse {
  status: boolean;
  message: string;
  errorcode: string;
  data: {
    jwtToken: string;
    refreshToken: string;
    feedToken: string;
  };
}

class MarketDataService {
  private clientcode: string;
  private password: string;
  private totpSecret: string;
  private privateKey: string;
  private localIP: string;
  private publicIP: string;
  private macAddress: string;
  private jwtToken: string | null = null;
  private tokenExpiry: number = 0;
  private cache: Map<string, { data: MarketData; timestamp: number }> = new Map();
  private cacheTimeout = 60000; // 1 minute cache
  
  // Rate limiting properties
  private lastApiCall: number = 0;
  private apiCallQueue: Array<() => Promise<unknown>> = [];
  private isProcessingQueue: boolean = false;
  private readonly MIN_API_INTERVAL = 100; // 100ms between calls (10 calls per second max)

  constructor() {
    this.clientcode = process.env.NEXT_PUBLIC_SMARTAPI_CLIENT_CODE || '';
    this.password = process.env.NEXT_PUBLIC_SMARTAPI_PASSWORD || '';
    this.totpSecret = process.env.NEXT_PUBLIC_SMARTAPI_TOTP_SECRET || '';
    this.privateKey = process.env.NEXT_PUBLIC_SMARTAPI_API_KEY || '';
    this.localIP = process.env.NEXT_PUBLIC_SMARTAPI_LOCAL_IP || '';
    this.publicIP = process.env.NEXT_PUBLIC_SMARTAPI_PUBLIC_IP || '';
    this.macAddress = process.env.NEXT_PUBLIC_SMARTAPI_MAC_ADDRESS || '';
    
    if (!this.clientcode || !this.password || !this.totpSecret || !this.privateKey) {
      console.warn('SmartAPI credentials not found in environment variables');
    }
  }

  private async getJwtToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    if (this.jwtToken && Date.now() < this.tokenExpiry - 300000) {
      return this.jwtToken;
    }

    try {
      const totp = authenticator.generate(this.totpSecret);
      
      const response = await fetch(
        "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
        {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "X-PrivateKey": this.privateKey,
            Accept: "application/json",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": this.localIP,
            "X-ClientPublicIP": this.publicIP,
            "X-MACAddress": this.macAddress,
            "X-UserType": "USER",
          },
          body: JSON.stringify({
            clientcode: this.clientcode,
            password: this.password,
            totp,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SmartAPILoginResponse = await response.json();
      
      if (!data.status || !data.data?.jwtToken) {
        throw new Error(data.message || 'Login failed');
      }

      this.jwtToken = data.data.jwtToken;
      this.tokenExpiry = Date.now() + 3600000; // 1 hour expiry
      
      console.log('✅ SmartAPI Login Successful');
      return this.jwtToken;
    } catch (error) {
      console.error('❌ SmartAPI Login failed:', error);
      throw error;
    }
  }

  // Rate limiting method to ensure we don't exceed API limits
  private async rateLimitedApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.apiCallQueue.push(async () => {
        try {
          const result = await apiCall();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.apiCallQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.apiCallQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastApiCall;

      if (timeSinceLastCall < this.MIN_API_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, this.MIN_API_INTERVAL - timeSinceLastCall));
      }

      const apiCall = this.apiCallQueue.shift();
      if (apiCall) {
        this.lastApiCall = Date.now();
        await apiCall();
      }
    }

    this.isProcessingQueue = false;
  }

  private async fetchQuote(symbolTokens: { [exchange: string]: string[] }, mode: 'FULL' | 'OHLC' | 'LTP' = 'FULL'): Promise<MarketData[]> {
    return this.rateLimitedApiCall(async () => {
      try {
        const jwtToken = await this.getJwtToken();

        const response = await fetch(
          "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/",
          {
            method: 'POST',
            headers: {
              "Authorization": `Bearer ${jwtToken}`,
              "X-PrivateKey": this.privateKey,
              "X-SourceID": "WEB",
              "X-ClientLocalIP": this.localIP,
              "X-ClientPublicIP": this.publicIP,
              "X-MACAddress": this.macAddress,
              "X-UserType": "USER",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode,
              exchangeTokens: symbolTokens,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: SmartAPIQuoteResponse = await response.json();
        
        if (!data.status || !data.data?.fetched) {
          throw new Error(data.message || 'Invalid API response format');
        }

        return data.data.fetched.map(quote => ({
          symbol: quote.tradingSymbol,
          price: quote.ltp,
          change: quote.netChange,
          changePercent: quote.percentChange,
          lastUpdated: quote.exchFeedTime,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
          volume: quote.tradeVolume,
        }));
      } catch (error) {
        console.error('Error fetching quote:', error);
        return [];
      }
    });
  }

  async getCandleData(
    exchange: string,
    symbolToken: string,
    interval: string,
    fromDate: string,
    toDate: string
  ): Promise<Array<[string, number, number, number, number, number]>> {
    try {
      const jwtToken = await this.getJwtToken();

      const response = await fetch(
        "https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData",
        {
          method: 'POST',
          headers: {
            "Authorization": `Bearer ${jwtToken}`,
            "X-PrivateKey": this.privateKey,
            "X-SourceID": "WEB",
            "X-ClientLocalIP": this.localIP,
            "X-ClientPublicIP": this.publicIP,
            "X-MACAddress": this.macAddress,
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
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SmartAPICandleResponse = await response.json();
      
      if (!data.status || !data.data) {
        throw new Error(data.message || 'Invalid API response format');
      }

      return data.data;
    } catch (error) {
      console.error('Error fetching candle data:', error);
      return [];
    }
  }

  private getCachedData(symbol: string): MarketData | null {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(symbol: string, data: MarketData): void {
    this.cache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    // Check cache first
    const cachedData = this.getCachedData(symbol);
    if (cachedData) {
      return cachedData;
    }

    // Map symbols to SmartAPI tokens
    const symbolTokenMap: { [key: string]: { exchange: string; token: string } } = {
      'BSE:SENSEX': { exchange: 'BSE', token: '99919000' },  // Correct BSE SENSEX token
      'NSE:NIFTY': { exchange: 'NSE', token: '26000' },      // NSE NIFTY 50 token
      'SBIN-EQ': { exchange: 'NSE', token: '3045' },         // SBI token
    };

    const symbolInfo = symbolTokenMap[symbol];
    if (!symbolInfo) {
      console.warn(`Symbol ${symbol} not found in token map`);
      return this.getFallbackData(symbol);
    }

    try {
      // Fetch fresh data using SmartAPI
      const quotes = await this.fetchQuote(
        { [symbolInfo.exchange]: [symbolInfo.token] },
        'FULL'
      );
      
      if (quotes.length > 0) {
        const quote = quotes[0];
        this.setCachedData(symbol, quote);
        return quote;
      }
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
    }

    // Return fallback data if API fails
    return this.getFallbackData(symbol);
  }

  async getSensexData(): Promise<MarketData> {
    return this.getMarketData('BSE:SENSEX');
  }

  async getNiftyData(): Promise<MarketData> {
    return this.getMarketData('NSE:NIFTY');
  }

  async getSBINData(): Promise<MarketData> {
    return this.getMarketData('SBIN-EQ');
  }

  // Method to get multiple quotes at once for better performance
  async getMultipleQuotes(symbols: string[]): Promise<MarketData[]> {
    const symbolTokenMap: { [key: string]: { exchange: string; token: string } } = {
      'BSE:SENSEX': { exchange: 'BSE', token: '99919000' },  // Correct BSE SENSEX token
      'NSE:NIFTY': { exchange: 'NSE', token: '26000' },      // NSE NIFTY 50 token
      'SBIN-EQ': { exchange: 'NSE', token: '3045' },         // SBI token
    };

    const exchangeTokens: { [exchange: string]: string[] } = {};
    
    symbols.forEach(symbol => {
      const symbolInfo = symbolTokenMap[symbol];
      if (symbolInfo) {
        if (!exchangeTokens[symbolInfo.exchange]) {
          exchangeTokens[symbolInfo.exchange] = [];
        }
        exchangeTokens[symbolInfo.exchange].push(symbolInfo.token);
      }
    });

    try {
      return await this.fetchQuote(exchangeTokens, 'FULL');
    } catch (error) {
      console.error('Error fetching multiple quotes:', error);
      return symbols.map(symbol => this.getFallbackData(symbol));
    }
  }

  public getFallbackData(symbol: string): MarketData {
    // Using 0 to represent missing data
    const fallbackData: Record<string, MarketData> = {
      'BSE:SENSEX': {
        symbol: 'SENSEX',
        price: 81500.00,
        change: 150.25,
        changePercent: 0.18,
        lastUpdated: new Date().toISOString().split('T')[0],
        open: 81350.00,
        high: 81650.00,
        low: 81200.00,
        close: 81500.00,
        volume: 0 // Indices don't have meaningful volume
      },
      'NSE:NIFTY': {
        symbol: 'NIFTY',
        price: 24800.00,
        change: 45.50,
        changePercent: 0.18,
        lastUpdated: new Date().toISOString().split('T')[0],
        open: 24755.00,
        high: 24850.00,
        low: 24720.00,
        close: 24800.00,
        volume: 0 // Indices don't have meaningful volume
      },
      'SBIN-EQ': {
        symbol: 'SBIN-EQ',
        price: 825.00,
        change: 12.50,
        changePercent: 1.54,
        lastUpdated: new Date().toISOString().split('T')[0],
        open: 815.00,
        high: 830.00,
        low: 810.00,
        close: 825.00,
        volume: 1250000
      }
    };

    return fallbackData[symbol] || {
      symbol: symbol.split(':')[1] || symbol,
      price: 1000.00,
      change: 10.00,
      changePercent: 1.00,
      lastUpdated: new Date().toISOString().split('T')[0],
      open: 990.00,
      high: 1020.00,
      low: 985.00,
      close: 1000.00,
      volume: 0
    };
  }

  public getAllFallbackData(): MarketData[] {
    return [
      this.getFallbackData('BSE:SENSEX'),
      this.getFallbackData('NSE:NIFTY')
    ];
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  }

  formatChange(change: number, changePercent: number): string {
    const sign = change >= 0 ? '+' : '';
    const formattedChange = this.formatPrice(Math.abs(change));
    const formattedPercent = Math.abs(changePercent).toFixed(2);
    
    return `${sign}${formattedChange} (${sign}${formattedPercent}%)`;
  }

  // Enhanced methods for real-time data fetching with loading states
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastUpdateTimes: Map<string, Date> = new Map();

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
        lastUpdated: this.lastUpdateTimes.get(symbol) || null
      };
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
      
      try {
        const fallbackData = this.getFallbackData(symbol);
        return {
          data: fallbackData,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastUpdated: this.lastUpdateTimes.get(symbol) || null
        };
      } catch (fallbackError) {
        return {
          data: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load data',
          lastUpdated: this.lastUpdateTimes.get(symbol) || null
        };
      }
    }
  }

  async getAllMarketDataWithStatus(): Promise<{
    sensex: { data: MarketData | null; isLoading: boolean; error: string | null; lastUpdated: Date | null };
    nifty: { data: MarketData | null; isLoading: boolean; error: string | null; lastUpdated: Date | null };
  }> {
    try {
      // Use individual calls for better reliability
      const [sensex, nifty] = await Promise.all([
        this.getMarketDataWithStatus('BSE:SENSEX'),
        this.getMarketDataWithStatus('NSE:NIFTY')
      ]);

      return { sensex, nifty };
    } catch (error) {
      console.error('Error in market data fetch:', error);
      
      // Return error states for all
      return {
        sensex: {
          data: null,
          isLoading: false,
          error: 'Failed to fetch SENSEX data',
          lastUpdated: this.lastUpdateTimes.get('BSE:SENSEX') || null
        },
        nifty: {
          data: null,
          isLoading: false,
          error: 'Failed to fetch NIFTY data',
          lastUpdated: this.lastUpdateTimes.get('NSE:NIFTY') || null
        }
      };
    }
  }

  startAutoRefresh(
    symbol: string, 
    intervalMs: number = 60000, // Increased default to 60 seconds to respect rate limits
    onUpdate?: (data: MarketData | null, error?: string) => void
  ): void {
    // Clear existing interval if any
    this.stopAutoRefresh(symbol);

    // Ensure minimum interval of 10 seconds to respect rate limits (10 req/sec = max 1 req per 100ms, but we're being conservative)
    const safeIntervalMs = Math.max(intervalMs, 10000);

    const interval = setInterval(async () => {
      try {
        const result = await this.getMarketDataWithStatus(symbol);
        onUpdate?.(result.data, result.error || undefined);
      } catch (error) {
        console.error(`Auto-refresh error for ${symbol}:`, error);
        try {
          const fallbackData = this.getFallbackData(symbol);
          onUpdate?.(fallbackData, error instanceof Error ? error.message : 'Unknown error');
        } catch (fallbackError) {
          onUpdate?.(null, error instanceof Error ? error.message : 'Unknown error');
        }
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
    
    return (Date.now() - lastUpdated.getTime()) < maxAgeMs;
  }
}

export const marketDataService = new MarketDataService();
export type { MarketData };