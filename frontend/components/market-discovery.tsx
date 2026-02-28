"use client";

import React, { useEffect, useState } from "react";
import { marketDataService, type MarketData } from "@/lib/market-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";

interface PerformerItem {
  symbol: string;
  ltp: number;
  changePct: number;
}

interface QuoteLike {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
}

interface DiscoveryResponse {
  mostBought: QuoteLike[];
  topGainers: QuoteLike[];
  topLosers: QuoteLike[];
  pocketFriendly: {
    under50: QuoteLike[];
    under100: QuoteLike[];
    under200: QuoteLike[];
  };
}

interface PerformersResponse {
  performers: Array<{ symbol: string; price: number; changePct: number }>;
}

interface TechnicalScreenerItem {
  symbol: string;
  price: number;
  changePercent: number;
  signal: string;
}

interface TechnicalScreenersResponse {
  screeners: TechnicalScreenerItem[];
}

function PriceBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <Badge
      className={
        positive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </Badge>
  );
}

export default function MarketDiscovery() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostBought, setMostBought] = useState<MarketData[]>([]);
  const [gainers, setGainers] = useState<MarketData[]>([]);
  const [losers, setLosers] = useState<MarketData[]>([]);
  const [pf50, setPf50] = useState<MarketData[]>([]);
  const [pf100, setPf100] = useState<MarketData[]>([]);
  const [pf200, setPf200] = useState<MarketData[]>([]);
  const [pfTab, setPfTab] = useState<"50" | "100" | "200">("50");

  const [tf, setTf] = useState<"1W" | "1M" | "1Y" | "5Y">("1W");
  const [performers, setPerformers] = useState<PerformerItem[]>([]);
  const [loadingPerformers, setLoadingPerformers] = useState(false);
  const [technicalScreeners, setTechnicalScreeners] = useState<
    TechnicalScreenerItem[]
  >([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const resp = await fetch(`/api/market/discovery`);
        if (!resp.ok) throw new Error("bad_response");
        const lists: DiscoveryResponse = await resp.json();
        const map = (q: QuoteLike): MarketData => ({
          symbol: q.symbol,
          price: Number(q.regularMarketPrice || 0),
          change: Number(q.regularMarketChange || 0),
          changePercent: Number(q.regularMarketChangePercent || 0),
          lastUpdated: new Date().toISOString(),
        });
        setMostBought((lists.mostBought || []).map(map));
        const gs = (lists.topGainers || []).map(map);
        const ls = (lists.topLosers || []).map(map);
        setGainers(gs);
        setLosers(ls);
        setPf50((lists.pocketFriendly?.under50 || []).map(map));
        setPf100((lists.pocketFriendly?.under100 || []).map(map));
        setPf200((lists.pocketFriendly?.under200 || []).map(map));
        setLoading(false);
      } catch {
        setError("Failed to load discovery data");
        setLoading(false);
      }
    };
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const loadMovers = async () => {
      try {
        const resp = await fetch(`/api/market/gainers-losers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datatype: "PercPriceGainers",
            expirytype: "NEAR",
          }),
        });
        if (resp.ok) {
          const jl: {
            source: string;
            items?: Array<{ tradingSymbol: string; percentChange?: number }>;
          } = await resp.json();
          if (jl.source === "smartapi" && Array.isArray(jl.items)) {
            const mapItem = (x: {
              tradingSymbol: string;
              percentChange?: number;
            }): MarketData => ({
              symbol: x.tradingSymbol,
              price: 0,
              change: 0,
              changePercent: Number(x.percentChange || 0),
              lastUpdated: new Date().toISOString(),
            });
            const arr = jl.items.map(mapItem);
            setGainers(arr.slice(0, 8));
            // losers call:
            const resp2 = await fetch(`/api/market/gainers-losers`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                datatype: "PercPriceLosers",
                expirytype: "NEAR",
              }),
            });
            if (resp2.ok) {
              const jl2: {
                source: string;
                items?: Array<{
                  tradingSymbol: string;
                  percentChange?: number;
                }>;
              } = await resp2.json();
              if (jl2.source === "smartapi" && Array.isArray(jl2.items)) {
                setLosers(jl2.items.map(mapItem).slice(0, 8));
              }
            }
          }
        }
      } catch {}
    };
    loadMovers();
  }, []);

  useEffect(() => {
    const loadScreeners = async () => {
      try {
        const resp = await fetch(`/api/market/technical-screeners`);
        if (resp.ok) {
          const data: TechnicalScreenersResponse = await resp.json();
          setTechnicalScreeners(data.screeners || []);
        }
      } catch (e) {
        console.error("Failed to load technical screeners:", e);
        setTechnicalScreeners([]);
      }
    };
    loadScreeners();
    const interval = setInterval(loadScreeners, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadPerf = async () => {
      try {
        setLoadingPerformers(true);
        setPerformers([]); // Clear previous data while loading
        console.log(`[Frontend] Loading performers for timeframe: ${tf}`);
        const resp = await fetch(`/api/market/performers?tf=${tf}`);
        if (resp.ok) {
          const data: PerformersResponse = await resp.json();
          const mapped = (data.performers || []).map((p) => ({
            symbol: p.symbol,
            ltp: p.price,
            changePct: p.changePct,
          }));
          console.log(
            `[Frontend] Loaded ${mapped.length} performers for ${tf}`,
          );
          setPerformers(mapped);
        } else {
          console.error(`[Frontend] Failed to load performers: ${resp.status}`);
          setPerformers([]);
        }
      } catch (e) {
        console.error("[Frontend] Failed to load performers:", e);
        setPerformers([]);
      } finally {
        setLoadingPerformers(false);
      }
    };
    loadPerf();
  }, [tf]);

  const header = (title: string, section?: string) => (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
        {title}
      </h3>
      {section && (
        <a
          href={`/dashboard/market/view-all?section=${encodeURIComponent(section)}`}
          className="text-xs text-blue-600"
        >
          VIEW ALL
        </a>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="border rounded-lg p-4">
        {header("Most Bought Stocks", "most-bought")}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {!loading && mostBought.length === 0 && (
            <div className="text-xs text-gray-500">
              No data available right now.
            </div>
          )}
          {(loading ? [] : mostBought).slice(0, 5).map((s, idx) => (
            <div key={idx} className="border rounded-lg p-3">
              <div className="text-sm font-semibold">{s.symbol}</div>
              <div className="text-xs text-gray-500">LTP</div>
              <div className="flex items-center gap-2">
                <span className="text-sm">₹{s.price.toFixed(2)}</span>
                <PriceBadge value={s.changePercent} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        {header("Top Movers and Sectorwise Movements", "top-movers")}
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-100 text-green-800">Gainers</Badge>
            </div>
            <div className="divide-y">
              {!loading && gainers.length === 0 && (
                <div className="text-xs text-gray-500">
                  No data available right now.
                </div>
              )}
              {(loading ? [] : gainers).slice(0, 5).map((g, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium">{g.symbol}</div>
                  </div>
                  <div className="w-36 text-right">₹{g.price.toFixed(2)}</div>
                  <div className="w-24 text-right text-green-700 flex items-center gap-1 justify-end">
                    <TrendingUp className="h-3 w-3" /> {g.change.toFixed(2)}
                  </div>
                  <div className="w-24 text-right">
                    <PriceBadge value={g.changePercent} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-red-100 text-red-800">Losers</Badge>
            </div>
            <div className="divide-y">
              {!loading && losers.length === 0 && (
                <div className="text-xs text-gray-500">
                  No data available right now.
                </div>
              )}
              {(loading ? [] : losers).slice(0, 5).map((g, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium">{g.symbol}</div>
                  </div>
                  <div className="w-36 text-right">₹{g.price.toFixed(2)}</div>
                  <div className="w-24 text-right text-red-700 flex items-center gap-1 justify-end">
                    <TrendingDown className="h-3 w-3" /> {g.change.toFixed(2)}
                  </div>
                  <div className="w-24 text-right">
                    <PriceBadge value={g.changePercent} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        {header("Top Performers", "top-performers")}
        <div className="flex items-center justify-between mb-3">
          <Tabs
            value={tf}
            onValueChange={(v: string) => setTf(v as "1W" | "1M" | "1Y" | "5Y")}
          >
            <TabsList>
              <TabsTrigger value="1W">1 Week</TabsTrigger>
              <TabsTrigger value="1M">1 Month</TabsTrigger>
              <TabsTrigger value="1Y">1 Year</TabsTrigger>
              <TabsTrigger value="5Y">5 Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {loadingPerformers && (
            <div className="col-span-full text-xs text-gray-500 text-center py-4">
              Loading performers for {tf}...
            </div>
          )}
          {!loadingPerformers && performers.length === 0 && (
            <div className="col-span-full text-xs text-gray-500 text-center py-4">
              No performers data available for {tf}
            </div>
          )}
          {!loadingPerformers &&
            performers.map((p, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="text-sm font-semibold">{p.symbol}</div>
                <div className="text-xs text-gray-500">₹{p.ltp.toFixed(2)}</div>
                <div className="mt-2">
                  <PriceBadge value={p.changePct} />
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        {header("Technical Screeners", "technical-screeners")}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {!loading && technicalScreeners.length === 0 && (
            <div className="text-xs text-gray-500">
              No data available right now.
            </div>
          )}
          {technicalScreeners.map((s, idx) => (
            <div key={idx} className="border rounded-lg p-3">
              <div className="text-sm font-semibold">{s.symbol}</div>
              <div className="text-xs text-gray-500">
                {s.signal === "BULLISH" && (
                  <span className="text-green-600 font-medium">
                    🟢 BULLISH (EMA)
                  </span>
                )}
                {s.signal === "BEARISH" && (
                  <span className="text-red-600 font-medium">
                    🔴 BEARISH (EMA)
                  </span>
                )}
                {s.signal === "NEUTRAL" && (
                  <span className="text-gray-600 font-medium">
                    ⚪ NEUTRAL (EMA)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">₹{s.price.toFixed(2)}</span>
                <PriceBadge value={s.changePercent} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        {header("Pocket Friendly Stocks", "pocket-friendly")}
        <div className="flex items-center gap-2 mb-3">
          <button
            className={`px-2 py-1 text-xs rounded ${pfTab === "50" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            onClick={() => setPfTab("50")}
          >
            ≤50
          </button>
          <button
            className={`px-2 py-1 text-xs rounded ${pfTab === "100" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            onClick={() => setPfTab("100")}
          >
            ≤100
          </button>
          <button
            className={`px-2 py-1 text-xs rounded ${pfTab === "200" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            onClick={() => setPfTab("200")}
          >
            ≤200
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(pfTab === "50" ? pf50 : pfTab === "100" ? pf100 : pf200)
            .slice(0, 5)
            .map((s, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="text-sm font-semibold">{s.symbol}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">₹{s.price.toFixed(2)}</span>
                  <PriceBadge value={s.changePercent} />
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Join our Community
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost">YouTube</Button>
          <Button variant="ghost">Twitter</Button>
          <Button variant="ghost">Telegram</Button>
          <Button variant="ghost">Instagram</Button>
        </div>
      </div>
    </div>
  );
}
