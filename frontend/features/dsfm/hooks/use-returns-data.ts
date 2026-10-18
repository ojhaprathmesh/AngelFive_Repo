import { useCallback, useEffect, useRef, useState } from "react";

import type { ReturnsData } from "@/features/dsfm/types";

interface UseReturnsDataReturn {
  data: ReturnsData | null;
  loading: boolean;
  error: string | null;
  priceChartRef: React.RefObject<HTMLDivElement | null>;
  returnsChartRef: React.RefObject<HTMLDivElement | null>;
}

export function useReturnsData(
  symbol: string,
  timeframe: string,
): UseReturnsDataReturn {
  const [data, setData] = useState<ReturnsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const priceChartRef = useRef<HTMLDivElement>(null);
  const returnsChartRef = useRef<HTMLDivElement>(null);

  const fetchReturnsData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const resp = await fetch(
        `/api/dsfm/returns?symbol=${symbol}&timeframe=${timeframe}`,
      );
      const contentType = resp.headers.get("content-type");
      if (resp.ok && contentType && contentType.includes("application/json")) {
        const result: ReturnsData = await resp.json();
        setData(result);
        setError(null);
      } else {
        let errorMessage = `Failed to fetch data (${resp.status} ${resp.statusText})`;
        try {
          const responseClone = resp.clone();
          if (contentType && contentType.includes("application/json")) {
            const errorData = await responseClone.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const text = await responseClone.text();
            if (text) {
              try {
                const jsonData = JSON.parse(text);
                errorMessage =
                  jsonData.error || jsonData.message || errorMessage;
              } catch {
                errorMessage = text;
              }
            }
          }
        } catch {
          // ignore parse error
        }
        if (
          errorMessage.includes("SmartAPI") ||
          errorMessage.includes("JWT token") ||
          errorMessage.includes("SMARTAPI")
        ) {
          errorMessage = "SmartAPI credentials not configured";
        }
        setError(errorMessage);
      }
    } catch (e: unknown) {
      const errorMessage =
        (e as Error).message ||
        "Network error. Make sure backend is running on port 5000.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    if (symbol) {
      void fetchReturnsData();
    }
  }, [symbol, timeframe, fetchReturnsData]);

  return { data, loading, error, priceChartRef, returnsChartRef };
}
