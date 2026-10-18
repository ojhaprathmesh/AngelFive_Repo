/**
 * features/watchlists/hooks/useWatchlistData.ts
 *
 * Feature-owned hook for watchlist state management and data fetching.
 * Moved from components/watchlist/hooks/ to establish clear feature ownership.
 */

import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/features/auth";
import type { StockItem } from "@/features/market/types";
import {
  type WatchlistItem,
  watchlistService,
} from "@/features/watchlists/services/watchlists";

export function useWatchlistData() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || null;

  const [watchlists, setWatchlists] = useState<WatchlistItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [symbols, setSymbols] = useState<StockItem[]>([]);
  const [loadingSymbols, setLoadingSymbols] = useState<boolean>(false);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string>("NSE");
  const selectedSymbolRef = useRef<string | null>(null);

  // Sync ref for symbol to avoid stale closures in effects
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  // Load Watchlists
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsub = watchlistService.subscribe(
      uid,
      (items) => {
        setWatchlists(items);
        if (!selectedId && items.length > 0) {
          setSelectedId(items[0].id);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [selectedId, uid]);

  // Load and poll symbols for the selected watchlist
  useEffect(() => {
    if (!uid || !selectedId) return;

    const fetchSymbols = async (showLoading = true) => {
      try {
        if (showLoading) setLoadingSymbols(true);
        const listSymbols = await watchlistService.getSymbols(uid, selectedId);
        const names = listSymbols.map((s) => s.symbol).filter(Boolean);
        if (names.length > 0) {
          const resp = await fetch(`/api/market/smartapi/quote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols: names }),
          });
          if (resp.ok) {
            const json = await resp.json();
            const q = Array.isArray(json?.quotes) ? json.quotes : [];
            const mapped: StockItem[] = names.map((name) => {
              const nameUpper = name.toUpperCase();
              const qInfo = q.find(
                (x: any) =>
                  x.symbol &&
                  (x.symbol.toUpperCase() === nameUpper ||
                    x.symbol.toUpperCase() === `${nameUpper}-EQ` ||
                    x.symbol.toUpperCase().startsWith(`${nameUpper}-`)),
              );
              return {
                symbol: name,
                exchange: qInfo ? String(qInfo.exchange || "NSE") : "NSE",
                price: qInfo ? Number(qInfo.price || 0) : 0,
                changePct: qInfo
                  ? Number(qInfo.changePercent || qInfo.changePct || 0)
                  : 0,
                change: qInfo ? Number(qInfo.change || 0) : 0,
              };
            });

            setSymbols((prev) => {
              return mapped.map((newItem) => {
                const existing = prev.find((p) => p.symbol === newItem.symbol);
                return existing ? { ...existing, ...newItem } : newItem;
              });
            });

            if (!selectedSymbolRef.current && mapped.length > 0) {
              setSelectedSymbol(mapped[0].symbol);
              setSelectedExchange(mapped[0].exchange);
            }
          } else {
            if (showLoading) setSymbols([]);
          }
        } else {
          if (showLoading) setSymbols([]);
        }
      } catch {
        if (showLoading) setSymbols([]);
      } finally {
        if (showLoading) setLoadingSymbols(false);
      }
    };

    void fetchSymbols(true);
    const interval = setInterval(() => fetchSymbols(false), 10000);
    return () => clearInterval(interval);
  }, [uid, selectedId]);

  return {
    uid,
    watchlists,
    setWatchlists,
    selectedId,
    setSelectedId,
    loading,
    error,
    setError,
    symbols,
    setSymbols,
    loadingSymbols,
    selectedSymbol,
    setSelectedSymbol,
    selectedExchange,
    setSelectedExchange,
  };
}
