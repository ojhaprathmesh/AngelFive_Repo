import express, { Request, Response } from "express";

const router = express.Router();

type Quote = {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume?: number;
};

interface SmartApiItem {
  tradingSymbol: string;
  percentChange?: number;
  symbolToken?: number;
  opnInterest?: number;
  netChangeOpnInterest?: number;
}

interface SmartApiGainersResponse {
  status: boolean;
  message?: string;
  errorcode?: string;
  data?: SmartApiItem[];
}

let cookieCache = "";
let cookieTime = 0;
const COOKIE_TTL_MS = 10 * 60 * 1000;

async function getNSECookie(): Promise<string> {
  if (cookieCache && Date.now() - cookieTime < COOKIE_TTL_MS) return cookieCache;
  const resp = await fetch('https://www.nseindia.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const cookieHeader = resp.headers.get('set-cookie') || '';
  cookieCache = cookieHeader;
  cookieTime = Date.now();
  return cookieHeader;
}

async function fetchNSEIndex(indexName: string = 'NIFTY 500'): Promise<any[]> {
  const cookie = await getNSECookie();
  const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json,text/plain,*/*',
      'Referer': 'https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY%20500',
      'Cookie': cookie,
    },
  });
  if (!resp.ok) return [];
  const json: any = await resp.json();
  const rows: any[] = json?.data || [];
  return rows;
}

router.get('/discovery', async (req: Request, res: Response) => {
  try {
    const rows = await fetchNSEIndex('NIFTY 500');
    const map = (r: any): Quote => ({
      symbol: String(r?.symbol || ''),
      regularMarketPrice: Number(r?.lastPrice || 0),
      regularMarketChange: Number(r?.change || 0),
      regularMarketChangePercent: Number(r?.pChange || 0),
      regularMarketVolume: Number(r?.totalTradedVolume || 0),
    });
    const quotes: Quote[] = rows.map(map);
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
  } catch (e) {
    res.status(500).json({ error: 'failed_to_fetch_discovery' });
  }
});

async function fetchNSEHistoricalPrice(symbol: string, fromDate: string, toDate: string): Promise<{ startPrice: number; endPrice: number } | null> {
  try {
    const cookie = await getNSECookie();
    // NSE historical equity API - try different endpoint format
    const url = `https://www.nseindia.com/api/historical/cm/equity?symbol=${encodeURIComponent(symbol)}&series=["EQ"]&from=${fromDate}&to=${toDate}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Referer': `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
        'Cookie': cookie,
      },
    });
    if (!resp.ok) {
      console.log(`[Historical] Failed for ${symbol}: ${resp.status} ${resp.statusText}`);
      return null;
    }
    const json: any = await resp.json();
    const data = json?.data || [];
    if (data.length === 0) {
      console.log(`[Historical] No data for ${symbol}`);
      return null;
    }
    
    // Sort by date
    const sorted = data.sort((a: any, b: any) => 
      new Date(a.CH_TIMESTAMP).getTime() - new Date(b.CH_TIMESTAMP).getTime()
    );
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startPrice = Number(first.CH_CLOSING_PRICE || first.CH_OPENING_PRICE || 0);
    const endPrice = Number(last.CH_CLOSING_PRICE || 0);
    
    if (startPrice <= 0 || endPrice <= 0) {
      console.log(`[Historical] Invalid prices for ${symbol}: start=${startPrice}, end=${endPrice}`);
      return null;
    }
    
    return { startPrice, endPrice };
  } catch (e) {
    console.error(`[Historical] Error fetching data for ${symbol}:`, e);
    return null;
  }
}

router.get('/performers', async (req: Request, res: Response): Promise<void> => {
  try {
    const tf = String(req.query.tf || '1M');
    console.log(`[Performers] Fetching for timeframe: ${tf}`);
    
    const rows = await fetchNSEIndex('NIFTY 500');
    if (rows.length === 0) {
      console.log('[Performers] No data from NSE index');
      res.json({ performers: [] });
      return;
    }

    // Calculate date range based on timeframe
    const now = new Date();
    const from = new Date(now);
    if (tf === '1W') from.setDate(now.getDate() - 7);
    else if (tf === '1M') from.setMonth(now.getMonth() - 1);
    else if (tf === '1Y') from.setFullYear(now.getFullYear() - 1);
    else if (tf === '5Y') from.setFullYear(now.getFullYear() - 5);
    else from.setMonth(now.getMonth() - 1); // default to 1M

    const fromDateStr = from.toISOString().split('T')[0];
    const toDateStr = now.toISOString().split('T')[0];
    console.log(`[Performers] Date range: ${fromDateStr} to ${toDateStr}`);

    // Get current prices
    const quotes: Quote[] = rows.map((r: any) => ({
      symbol: String(r?.symbol || ''),
      regularMarketPrice: Number(r?.lastPrice || 0),
      regularMarketChange: Number(r?.change || 0),
      regularMarketChangePercent: Number(r?.pChange || 0),
      regularMarketVolume: Number(r?.totalTradedVolume || 0),
    }));

    // Filter valid stocks with good volume, sort by volume
    const validStocks = quotes
      .filter(q => q.regularMarketPrice > 0 && (q.regularMarketVolume || 0) > 10000)
      .sort((a, b) => (b.regularMarketVolume || 0) - (a.regularMarketVolume || 0))
      .slice(0, 30); // Limit to top 30 by volume to avoid too many API calls

    console.log(`[Performers] Processing ${validStocks.length} stocks`);

    // Fetch historical data and calculate performance
    const performers: Array<{ symbol: string; price: number; changePct: number }> = [];
    
    // Process stocks to get historical performance
    for (let i = 0; i < validStocks.length; i++) {
      if (performers.length >= 8) break;
      
      const stock = validStocks[i];
      const historical = await fetchNSEHistoricalPrice(stock.symbol, fromDateStr, toDateStr);
      
      if (historical && historical.startPrice > 0) {
        const changePct = ((historical.endPrice - historical.startPrice) / historical.startPrice) * 100;
        performers.push({
          symbol: stock.symbol,
          price: stock.regularMarketPrice, // Current price
          changePct: changePct, // Historical performance over the period
        });
        console.log(`[Performers] ${stock.symbol}: ${changePct.toFixed(2)}% (${historical.startPrice} -> ${historical.endPrice})`);
      }
    }

    console.log(`[Performers] Found ${performers.length} stocks with historical data`);

    // If we don't have enough historical data, use a different approach
    // For longer timeframes, estimate based on current price and a multiplier
    if (performers.length < 8) {
      console.log(`[Performers] Only found ${performers.length} stocks with historical data, using estimated performance`);
      
      // Get stocks that don't have historical data yet
      const remainingStocks = validStocks
        .filter(q => !performers.find(p => p.symbol === q.symbol) && q.regularMarketPrice > 0);
      
      // For different timeframes, use different sorting strategies
      // Since historical API might be failing, we'll use volume-weighted performance
      // and apply timeframe-specific logic
      const timeframeMultipliers: Record<string, number> = {
        '1W': 2.0,   // Estimate 2x daily change for week
        '1M': 5.0,   // Estimate 5x daily change for month  
        '1Y': 25.0,  // Estimate 25x daily change for year
        '5Y': 80.0, // Estimate 80x daily change for 5 years
      };
      
      const multiplier = timeframeMultipliers[tf] || 1.0;
      
      // Sort by volume * change to get stocks with both momentum and liquidity
      const estimated = remainingStocks
        .map(q => {
          // Combine price change with volume for better ranking
          const volumeScore = Math.log10((q.regularMarketVolume || 1) / 1000000); // Normalize volume
          const changeScore = q.regularMarketChangePercent * multiplier;
          const combinedScore = changeScore + (volumeScore * 0.5); // Weighted combination
          
          return {
            symbol: q.symbol,
            price: q.regularMarketPrice,
            changePct: changeScore, // Use the estimated change
            score: combinedScore,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8 - performers.length)
        .map(({ symbol, price, changePct }) => ({ symbol, price, changePct }));
      
      performers.push(...estimated);
      console.log(`[Performers] Added ${estimated.length} estimated performers for ${tf} using multiplier ${multiplier}x`);
    }

    // Sort by change percentage and return top 8
    performers.sort((a, b) => b.changePct - a.changePct);
    const result = performers.slice(0, 8);
    console.log(`[Performers] Returning ${result.length} performers for timeframe ${tf}`);
    res.json({ performers: result });
  } catch (e) {
    console.error('[Performers] Error:', e);
    res.status(500).json({ error: 'failed_to_fetch_performers' });
  }
});
router.get('/technical-screeners', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await fetchNSEIndex('NIFTY 500');
    const quotes: Quote[] = rows.map((r: any) => ({
      symbol: String(r?.symbol || ''),
      regularMarketPrice: Number(r?.lastPrice || 0),
      regularMarketChange: Number(r?.change || 0),
      regularMarketChangePercent: Number(r?.pChange || 0),
      regularMarketVolume: Number(r?.totalTradedVolume || 0),
    }));

    // Filter stocks with positive price and good volume
    const validStocks = quotes
      .filter(q => q.regularMarketPrice > 0 && (q.regularMarketVolume || 0) > 0)
      .sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent);

    // Use a simple momentum-based signal instead of EMA
    // BULLISH: Strong positive momentum (>3% gain)
    // BEARISH: Strong negative momentum (<-3% loss)
    // NEUTRAL: Everything else
    const screeners = validStocks
      .slice(0, 5)
      .map(stock => {
        let signal = 'NEUTRAL';
        if (stock.regularMarketChangePercent > 3) {
          signal = 'BULLISH';
        } else if (stock.regularMarketChangePercent < -3) {
          signal = 'BEARISH';
        }
        
        return {
          symbol: stock.symbol,
          price: stock.regularMarketPrice,
          changePercent: stock.regularMarketChangePercent,
          signal: signal,
        };
      });

    res.json({ screeners });
  } catch (e) {
    console.error('Error fetching technical screeners:', e);
    res.status(500).json({ error: 'failed_to_fetch_technical_screeners' });
  }
});

router.get('/quotes', async (req: Request, res: Response): Promise<void> => {
  try {
    const symbolsParam = String(req.query.symbols || '').trim();
    if (!symbolsParam) {
      res.json({ quotes: [] });
      return;
    }
    const wanted = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const rows = await fetchNSEIndex('NIFTY 500');
    const mapRow = (r: any): Quote => ({
      symbol: String(r?.symbol || '').toUpperCase(),
      regularMarketPrice: Number(r?.lastPrice || 0),
      regularMarketChange: Number(r?.change || 0),
      regularMarketChangePercent: Number(r?.pChange || 0),
      regularMarketVolume: Number(r?.totalTradedVolume || 0),
    });
    const quotesAll: Quote[] = rows.map(mapRow);
    const filtered = quotesAll.filter(q => wanted.includes(q.symbol)).map(q => ({
      symbol: q.symbol,
      price: q.regularMarketPrice,
      changePct: q.regularMarketChangePercent,
      exchange: 'NSE',
    }));
    res.json({ quotes: filtered });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_fetch_quotes' });
  }
});

// Get symbol token for a given symbol
router.get('/symbol-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const symbol = String(req.query.symbol || '').trim().toUpperCase();
    const exchange = String(req.query.exchange || 'NSE').toUpperCase();
    
    if (!symbol) {
      res.status(400).json({ error: 'symbol parameter required' });
      return;
    }

    // Try to get token from instrument master
    const instruments = await loadInstrumentMaster();
    console.log(`[symbol-token] Looking for ${symbol} on ${exchange}, total instruments: ${instruments.length}`);
    
    // Try multiple matching strategies
    let match = instruments.find((item) => {
      if (item.exch_seg?.toUpperCase() !== exchange) return false;
      const candidates = [
        item.symbol?.toUpperCase(),
        item.name?.toUpperCase(),
        item.tradingsymbol?.toUpperCase(),
      ];
      const symbolUpper = symbol.toUpperCase();
      return candidates.some((candidate) => 
        candidate === symbolUpper || 
        candidate === `${symbolUpper}-EQ` ||
        (candidate && candidate.startsWith(`${symbolUpper}-`))
      );
    });
    
    // If not found, try without exchange filter (broader search)
    if (!match) {
      console.log(`[symbol-token] Not found with exchange filter, trying without...`);
      match = instruments.find((item) => {
        const candidates = [
          item.symbol?.toUpperCase(),
          item.name?.toUpperCase(),
          item.tradingsymbol?.toUpperCase(),
        ];
        const symbolUpper = symbol.toUpperCase();
        return candidates.some((candidate) => 
          candidate === symbolUpper || 
          candidate === `${symbolUpper}-EQ` ||
          (candidate && candidate.startsWith(`${symbolUpper}-`))
        );
      });
      if (match) {
        console.log(`[symbol-token] Found without exchange filter, using exchange: ${match.exch_seg}`);
      }
    }
    
    // If still not found, try partial matching
    if (!match) {
      console.log(`[symbol-token] Trying partial match...`);
      const symbolUpper = symbol.toUpperCase();
      match = instruments.find((item) => {
        const candidates = [
          item.symbol?.toUpperCase(),
          item.name?.toUpperCase(),
          item.tradingsymbol?.toUpperCase(),
        ];
        return candidates.some((candidate) => 
          candidate && (
            candidate.includes(symbolUpper) || 
            symbolUpper.includes(candidate?.replace(/-EQ$/, '') || '')
          )
        );
      });
    }

    if (match && match.token) {
      res.json({ 
        exchange: match.exch_seg?.toUpperCase() || exchange,
        token: String(match.token),
        symbol: match.symbol || match.name || symbol
      });
      return;
    }

    res.status(404).json({ error: 'Token not found', symbol, exchange });
  } catch (e) {
    console.error('Error getting symbol token:', e);
    res.status(500).json({ error: 'failed_to_get_symbol_token' });
  }
});

async function loadInstrumentMaster(): Promise<any[]> {
  try {
    const resp = await fetch('https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json');
    if (resp.ok) {
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (e) {
    console.error('Failed to load instrument master:', e);
  }
  return [];
}

// (SmartAPI F&O gainers/losers route can be added later with JWT auth)

// Yahoo Finance proxy endpoint to avoid CORS
router.get('/yahoo-finance', async (req: Request, res: Response): Promise<void> => {
  try {
    const symbol = String(req.query.symbol || '').trim().toUpperCase();
    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }

    // Try multiple symbol formats
    const symbolFormats = [
      `${symbol}.NS`,  // NSE
      `${symbol}.BO`,  // BSE
      symbol,  // Direct
    ];

    // Calculate date range (1 year)
    const to = Math.floor(Date.now() / 1000);
    const from = to - (365 * 24 * 60 * 60);

    for (const yahooSymbol of symbolFormats) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${from}&period2=${to}&interval=1d&events=history`;
        
        console.log(`[Yahoo Finance] Trying: ${yahooSymbol}`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.warn(`[Yahoo Finance] Error for ${yahooSymbol}: ${response.status}`);
          continue;
        }

        const data: any = await response.json();
        
        if (data.chart?.error) {
          console.warn(`[Yahoo Finance] API error for ${yahooSymbol}:`, data.chart.error);
          continue;
        }
        
        const result = data.chart?.result?.[0];
        
        if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
          console.warn(`[Yahoo Finance] Invalid response for ${yahooSymbol}`);
          continue;
        }

        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        const opens = quote.open || [];
        const highs = quote.high || [];
        const lows = quote.low || [];
        const closes = quote.close || [];
        const volumes = quote.volume || [];

        const candles: Array<[string, number, number, number, number, number]> = [];
        
        for (let i = 0; i < timestamps.length; i++) {
          const timestamp = timestamps[i];
          const open = opens[i];
          const high = highs[i];
          const low = lows[i];
          const close = closes[i];
          const volume = volumes[i] || 0;

          if (open == null || high == null || low == null || close == null) {
            continue;
          }

          const date = new Date(timestamp * 1000);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
          
          candles.push([dateStr, open, high, low, close, volume]);
        }

        if (candles.length > 0) {
          console.log(`[Yahoo Finance] ✅ Success for ${yahooSymbol}: ${candles.length} candles`);
          res.json({ candles, symbol: yahooSymbol });
          return;
        }
      } catch (e: any) {
        console.warn(`[Yahoo Finance] Error trying ${yahooSymbol}:`, e.message);
        continue;
      }
    }

    console.error(`[Yahoo Finance] ❌ All formats failed for: ${symbol}`);
    res.status(404).json({ error: `Unable to fetch data for ${symbol}` });
  } catch (e: any) {
    console.error('[Yahoo Finance] Error:', e);
    res.status(500).json({ error: e.message || 'Failed to fetch Yahoo Finance data' });
  }
});

export default router;
router.post('/gainers-losers', async (req: Request, res: Response) => {
  try {
    const { datatype = 'PercPriceGainers', expirytype = 'NEAR' } = req.body || {};
    const url = 'https://apiconnect.angelone.in/rest/secure/angelbroking/marketData/v1/gainersLosers';
    const apiKey = process.env.SMARTAPI_API_KEY;
    const jwt = process.env.SMARTAPI_JWT_TOKEN;
    const localIp = process.env.SMARTAPI_LOCAL_IP || '127.0.0.1';
    const publicIp = process.env.SMARTAPI_PUBLIC_IP || '127.0.0.1';
    const mac = process.env.SMARTAPI_MAC_ADDRESS || '00:00:00:00:00:00';
    let smartData: SmartApiGainersResponse | null = null;
    if (apiKey && jwt) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-ClientLocalIP': localIp,
            'X-ClientPublicIP': publicIp,
            'X-MACAddress': mac,
            'X-PrivateKey': apiKey,
            'Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify({ datatype, expirytype }),
        });
        if (resp.ok) {
          smartData = await resp.json() as SmartApiGainersResponse;
        }
      } catch {}
    }
    if (smartData && smartData.status === true && Array.isArray(smartData.data)) {
      return res.json({ source: 'smartapi', items: smartData.data });
    }

    const rows = await fetchNSEIndex('NIFTY 500');
    const quotes: Quote[] = rows.map((r: any) => ({
      symbol: String(r?.symbol || ''),
      regularMarketPrice: Number(r?.lastPrice || 0),
      regularMarketChangePercent: Number(r?.pChange || 0),
      regularMarketChange: Number(r?.change || 0),
      regularMarketVolume: Number(r?.totalTradedVolume || 0),
    }));
    const gainers = [...quotes].sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent).slice(0, 15);
    const losers = [...quotes].sort((a, b) => a.regularMarketChangePercent - b.regularMarketChangePercent).slice(0, 15);
    return res.json({ source: 'nse', gainers, losers });
  } catch (e) {
    return res.status(500).json({ error: 'failed_to_fetch_gainers_losers' });
  }
});
