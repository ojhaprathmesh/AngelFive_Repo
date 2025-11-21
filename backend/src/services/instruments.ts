import { fetch } from "undici";

interface InstrumentRow {
  symbol: string;
  token: string;
  exch_seg: string;
  name?: string;
}

class InstrumentsService {
  private cache: Map<string, InstrumentRow[]> = new Map();
  private lastFetch = 0;
  private ttlMs = 12 * 60 * 60 * 1000; // 12 hours

  private async load(): Promise<void> {
    const now = Date.now();
    if (this.cache.size && now - this.lastFetch < this.ttlMs) return;

    const url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Instrument master fetch failed: ${res.status}`);
    const data = (await res.json()) as InstrumentRow[];

    const byExchange: Record<string, InstrumentRow[]> = {};
    for (const row of data) {
      const key = row.exch_seg.toUpperCase();
      (byExchange[key] ||= []).push(row);
    }

    // Build cache
    this.cache.clear();
    for (const [exch, rows] of Object.entries(byExchange)) {
      this.cache.set(exch, rows);
    }
    this.lastFetch = now;
  }

  async getToken(exchange: string, tradingSymbol: string): Promise<string | null> {
    await this.load();
    const exch = exchange.toUpperCase();
    const rows = this.cache.get(exch) || [];
    const found = rows.find((r) => r.symbol.toUpperCase() === tradingSymbol.toUpperCase());
    return found?.token || null;
  }

  async getTokensForSymbols(exchange: string, symbols: string[]): Promise<string[]> {
    await this.load();
    const tokens: string[] = [];
    for (const s of symbols) {
      const t = await this.getToken(exchange, s);
      if (t) tokens.push(t);
    }
    return tokens;
  }
}

export const instrumentsService = new InstrumentsService();