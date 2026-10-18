import { useEffect, useState } from "react";

import {
  type MarketData as LiveMarketData,
  marketDataService,
} from "@/features/market/services/market-data";

export type IndexType =
  | "SENSEX"
  | "NIFTY"
  | "BANKNIFTY"
  | "INDIAVIX"
  | "FINNIFTY";

export function useLiveIndexData() {
  const [error, setError] = useState<string | null>(null);
  const [indexState, setIndexState] = useState<
    Record<IndexType, LiveMarketData | null>
  >({
    SENSEX: null,
    NIFTY: null,
    BANKNIFTY: null,
    INDIAVIX: null,
    FINNIFTY: null,
  });

  useEffect(() => {
    const map: Record<IndexType, string> = {
      SENSEX: "BSE:SENSEX",
      NIFTY: "NSE:NIFTY",
      BANKNIFTY: "NSE:BANKNIFTY",
      INDIAVIX: "NSE:INDIAVIX",
      FINNIFTY: "NSE:FINNIFTY",
    };

    const load = async () => {
      try {
        const keys: IndexType[] = [
          "SENSEX",
          "NIFTY",
          "BANKNIFTY",
          "INDIAVIX",
          "FINNIFTY",
        ];
        const updates: Record<IndexType, LiveMarketData | null> = {
          SENSEX: null,
          NIFTY: null,
          BANKNIFTY: null,
          INDIAVIX: null,
          FINNIFTY: null,
        };
        for (const k of keys) {
          const r = await marketDataService.getMarketDataWithStatus(map[k]);
          updates[k] = r.data;
        }
        setIndexState(updates);
        setError(null);
      } catch (err) {
        setError("Failed to fetch market data");
      }
    };

    void load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  return { indexState, error };
}
