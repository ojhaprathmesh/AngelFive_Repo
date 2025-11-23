"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { watchlistService, type WatchlistItem } from "@/lib/watchlists";
import { marketDataService } from "@/lib/market-data";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronLeft,
  Search,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TrendingUp, TrendingDown } from "lucide-react";
import { WatchlistChart } from "@/components/watchlist-chart";
import { MarketOverview } from "@/components/market-overview";
import { TradingChart } from "@/components/trading-chart";

interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
}

export default function WatchlistPage() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || null;

  const [watchlists, setWatchlists] = useState<WatchlistItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editPanelId, setEditPanelId] = useState<string | null>(null);
  const [editPanelName, setEditPanelName] = useState<string>("");
  const [panelEditing, setPanelEditing] = useState<boolean>(false);
  const [panelEditValue, setPanelEditValue] = useState<string>("");
  const [panelSaving, setPanelSaving] = useState<boolean>(false);
  const [symbols, setSymbols] = useState<StockItem[]>([]);
  const [loadingSymbols, setLoadingSymbols] = useState<boolean>(false);
  const [mainTab, setMainTab] = useState<"Chart" | "Overview">("Chart");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string>("NSE");
  const [chartKey, setChartKey] = useState<number>(0);
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [showAddStockModal, setShowAddStockModal] = useState<boolean>(false);
  const [newStockSymbol, setNewStockSymbol] = useState<string>("");
  const [addingStock, setAddingStock] = useState<boolean>(false);

  // Fetch market indices (SENSEX, NIFTY)
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const [sensexData, niftyData] = await Promise.all([
          marketDataService.getMarketDataWithStatus("BSE:SENSEX"),
          marketDataService.getMarketDataWithStatus("NSE:NIFTY"),
        ]);

        setMarketIndices([
          {
            name: "SENSEX",
            value: sensexData.data?.price || 0,
            change: sensexData.data?.change || 0,
            changePercent: sensexData.data?.changePercent || 0,
            isPositive: (sensexData.data?.change || 0) >= 0,
          },
          {
            name: "NIFTY",
            value: niftyData.data?.price || 0,
            change: niftyData.data?.change || 0,
            changePercent: niftyData.data?.changePercent || 0,
            isPositive: (niftyData.data?.change || 0) >= 0,
          },
        ]);
      } catch (err) {
        console.error("Error fetching market indices:", err);
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

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
      }
    );
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const horiz = Math.abs(e.deltaX) >= Math.abs(e.deltaY);
      const delta = horiz ? e.deltaX : e.deltaY;
      if (!horiz) e.preventDefault();
      try {
        el.scrollBy({ left: delta, behavior: "smooth" });
      } catch {
        el.scrollLeft += delta;
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const numberedTabs = useMemo(() => {
    return watchlists.map((wl, idx) => ({
      id: wl.id,
      number: idx + 1,
      name: wl.name,
    }));
  }, [watchlists]);

  useEffect(() => {
    if (!menuOpen || !uid) return;
    (async () => {
      try {
        const c = await watchlistService.getCounts(uid);
        setCounts(c);
      } catch {}
    })();
  }, [menuOpen, uid]);

  const applyReorder = async (fromId: string, toId: string) => {
    const current = [...watchlists];
    const fromIdx = current.findIndex((w) => w.id === fromId);
    const toIdx = current.findIndex((w) => w.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const moving = current[fromIdx];
    current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moving);
    setWatchlists(current);
    if (!uid) return;
    try {
      await watchlistService.reorder(
        uid,
        current.map((w) => w.id)
      );
    } catch {}
  };

  const openEditPanel = (id: string, name: string) => {
    setMenuOpen(false);
    setEditPanelId(id);
    setEditPanelName(name);
    setPanelEditing(false);
    setPanelEditValue("");
  };

  const savePanelRename = async () => {
    if (!uid || !editPanelId) return;
    try {
      setPanelSaving(true);
      const trimmed = panelEditValue.trim();
      if (!trimmed) return;
      const exists = watchlists.some(
        (w) =>
          w.name.toLowerCase() === trimmed.toLowerCase() && w.id !== editPanelId
      );
      if (exists) return;
      await watchlistService.rename(uid, editPanelId, trimmed);
      setEditPanelName(trimmed);
      setPanelEditing(false);
      setPanelEditValue("");
    } finally {
      setPanelSaving(false);
    }
  };

  const handleAddStock = async () => {
    if (!uid || !selectedId || !newStockSymbol.trim()) return;
    const symbol = newStockSymbol.trim().toUpperCase();
    try {
      setAddingStock(true);
      await watchlistService.addSymbol(uid, selectedId, symbol);
      setShowAddStockModal(false);
      setNewStockSymbol("");
      
      // Refresh symbols
      const listSymbols = await watchlistService.getSymbols(uid, selectedId);
      const names = listSymbols.map((s) => s.symbol).filter(Boolean);
      if (names.length > 0) {
        const resp = await fetch(
          `/api/market/quotes?symbols=${encodeURIComponent(names.join(","))}`
        );
        if (resp.ok) {
          const json = await resp.json();
          const q = Array.isArray(json?.quotes) ? json.quotes : [];
          const mapped: StockItem[] = q.map((x: any) => ({
            symbol: String(x.symbol || ""),
            exchange: String(x.exchange || "NSE"),
            price: Number(x.price || 0),
            changePct: Number(x.changePct || 0),
          }));
          setSymbols(mapped);
          // Auto-select the newly added symbol
          const addedStock = mapped.find(s => s.symbol === symbol);
          if (addedStock) {
            setSelectedSymbol(addedStock.symbol);
            setSelectedExchange(addedStock.exchange);
          }
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add stock");
    } finally {
      setAddingStock(false);
    }
  };

  type StockItem = {
    symbol: string;
    exchange: string;
    price: number;
    changePct: number;
    change?: number;
  };

  function StockCard({ item }: { item: StockItem }) {
    const positive = item.changePct >= 0;
    const PriceIcon = positive ? TrendingUp : TrendingDown;
    const color = positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    const bgColor = positive ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20";
    const change = item.change || (item.price * item.changePct / 100);

    return (
      <div 
        className={`flex items-center justify-between px-3 py-2.5 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedSymbol === item.symbol ? bgColor : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("[WatchlistPage] 🔵 Stock clicked:", item.symbol, item.exchange);
          console.log("[WatchlistPage] Current selectedSymbol:", selectedSymbol);
          console.log("[WatchlistPage] Current chartKey:", chartKey);
          
          // ALWAYS update, even if same symbol (to force refresh)
          setSelectedSymbol(item.symbol);
          setSelectedExchange(item.exchange);
          setChartKey(prev => {
            const newKey = prev + 1;
            console.log("[WatchlistPage] ✅ State updated - new selectedSymbol:", item.symbol, "chartKey:", newKey);
            return newKey;
          });
        }}
      >
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.symbol}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {item.exchange}
            </span>
          </div>
        </div>
        <div className={`flex flex-col items-end ${color}`}>
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold">
              ₹{item.price.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <PriceIcon className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs font-medium">
            {change >= 0 ? '+' : ''}{change.toFixed(2)} ({change >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%)
          </div>
        </div>
      </div>
    );
  }

  // Fetch and update stock prices
  useEffect(() => {
    if (!uid || !selectedId) return;
    
    const fetchSymbols = async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoadingSymbols(true);
        }
        const listSymbols = await watchlistService.getSymbols(uid, selectedId);
        const names = listSymbols.map((s) => s.symbol).filter(Boolean);
        if (names.length > 0) {
          const resp = await fetch(
            `/api/market/quotes?symbols=${encodeURIComponent(names.join(","))}`
          );
          if (resp.ok) {
            const json = await resp.json();
            type ApiQuote = {
              symbol?: string;
              exchange?: string;
              price?: number;
              changePct?: number;
            };
            const q: ApiQuote[] = Array.isArray(json?.quotes)
              ? json.quotes
              : [];
            const mapped: StockItem[] = q.map((x) => ({
              symbol: String(x.symbol || ""),
              exchange: String(x.exchange || "NSE"),
              price: Number(x.price || 0),
              changePct: Number(x.changePct || 0),
            }));
            // Update prices without showing loading
            setSymbols((prev) => {
              // Preserve selection and update prices
              return mapped.map((newItem) => {
                const existing = prev.find((p) => p.symbol === newItem.symbol);
                return existing ? { ...existing, ...newItem } : newItem;
              });
            });
            // Auto-select first symbol if none selected
            if (!selectedSymbol && mapped.length > 0) {
              setSelectedSymbol(mapped[0].symbol);
              setSelectedExchange(mapped[0].exchange);
            }
          } else {
            if (showLoading) {
              setSymbols([]);
            }
          }
        } else {
          if (showLoading) {
            setSymbols([]);
          }
        }
      } catch {
        if (showLoading) {
          setSymbols([]);
        }
      } finally {
        if (showLoading) {
          setLoadingSymbols(false);
        }
      }
    };

    // Initial load with loading
    fetchSymbols(true);
    // Poll for updates every 10 seconds without loading
    const interval = setInterval(() => fetchSymbols(false), 10000);
    return () => clearInterval(interval);
  }, [uid, selectedId]);

  // Filter symbols based on search
  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) return symbols;
    const query = searchQuery.toLowerCase();
    return symbols.filter(
      (s) =>
        s.symbol.toLowerCase().includes(query) ||
        s.exchange.toLowerCase().includes(query)
    );
  }, [symbols, searchQuery]);

  const handleCreate = async () => {
    if (!uid) return;
    try {
      setError(null);
      setCreating(true);
      const trimmed = newName.trim();
      if (!trimmed) throw new Error("Name is required");
      const exists = watchlists.some(
        (w) => w.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) throw new Error("A watchlist with this name already exists");
      await watchlistService.create(uid, trimmed);
      setShowCreate(false);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create watchlist");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Market Indices Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-6">
          {marketIndices.map((index) => (
            <div key={index.name} className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {index.name}:
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {index.value.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span
                className={`text-sm font-semibold ${
                  index.isPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {index.change >= 0 ? "+" : ""}
                {index.change.toFixed(2)} ({index.change >= 0 ? "+" : ""}
                {index.changePercent.toFixed(2)}%)
              </span>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar - Watchlist */}
        <aside className="w-80 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Watchlist Tabs */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <div
              ref={tabsRef}
              className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap"
              role="tablist"
            >
              {loading && (
                <span className="text-xs text-gray-500">Loading…</span>
              )}
              {!loading && numberedTabs.length === 0 && (
                <span className="text-xs text-gray-500">No watchlists</span>
              )}
              {numberedTabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={selectedId === tab.id ? "default" : "ghost"}
                  size="sm"
                  title={tab.name}
                  onClick={() => {
                    setSelectedId(tab.id);
                    setSelectedSymbol(null);
                  }}
                  className="w-8 h-8 p-0 text-xs font-semibold"
                >
                  {tab.number}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                aria-label="Add watchlist"
                title="Add watchlist"
                onClick={() => setShowCreate(true)}
                className="w-8 h-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[275px]">
                <div className="text-xs px-2 py-1.5 font-medium">Watchlists</div>
                <div className="space-y-1">
                  {numberedTabs.map((t) => {
                    const wl = watchlists.find((w) => w.id === t.id)!;
                    return (
                      <div
                        key={wl.id}
                        className="grid grid-cols-[22px_18px_1fr_32px_32px_32px] items-center h-7 rounded cursor-grab hover:bg-accent/30 gap-1 px-1"
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(wl.id);
                          e.dataTransfer.setData("text/plain", wl.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromId =
                            draggingId ||
                            e.dataTransfer.getData("text/plain");
                          const toId = wl.id;
                          setDraggingId(null);
                          if (fromId && fromId !== toId)
                            applyReorder(fromId, toId);
                        }}
                      >
                        <div className="text-[11px] text-muted-foreground px-1">
                          {t.number}
                        </div>
                        <div className="flex items-center justify-center">
                          <GripVertical className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex items-center px-1">
                          <span className="text-[12px] truncate">{wl.name}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground px-1">
                          {(counts[wl.id] ?? 0).toString()}
                        </div>
                        <div className="flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditPanel(wl.id, wl.name)}
                            aria-label="Edit"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete"
                            onClick={async () => {
                              if (!uid) return;
                              const ok = window.confirm(
                                `Delete watchlist "${wl.name}"?`
                              );
                              if (!ok) return;
                              try {
                                await watchlistService.remove(uid, wl.id);
                              } catch {}
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Edit Panel or Stock List */}
          {editPanelId ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditPanelId(null)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {panelEditing ? (
                    <input
                      value={panelEditValue}
                      onChange={(e) => setPanelEditValue(e.target.value)}
                      className="flex-1 min-w-0 rounded-md border bg-background px-2 h-8 text-sm"
                      placeholder="Enter new name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") savePanelRename();
                        if (e.key === "Escape") {
                          setPanelEditing(false);
                          setPanelEditValue("");
                        }
                      }}
                    />
                  ) : (
                    <span className="text-sm font-medium truncate">
                      {editPanelName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {panelEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={savePanelRename}
                        disabled={panelSaving}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setPanelEditing(false);
                          setPanelEditValue("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPanelEditing(true);
                        setPanelEditValue(editPanelName);
                      }}
                    >
                      Rename
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                      Add Stock
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter symbol (e.g., RELIANCE)"
                        className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && uid && editPanelId) {
                            const input = e.currentTarget;
                            const symbol = input.value.trim().toUpperCase();
                            if (symbol) {
                              try {
                                await watchlistService.addSymbol(uid, editPanelId, symbol);
                                input.value = "";
                                // Refresh symbols
                                const listSymbols = await watchlistService.getSymbols(uid, editPanelId);
                                const names = listSymbols.map((s) => s.symbol).filter(Boolean);
                                if (names.length > 0) {
                                  const resp = await fetch(
                                    `/api/market/quotes?symbols=${encodeURIComponent(names.join(","))}`
                                  );
                                  if (resp.ok) {
                                    const json = await resp.json();
                                    const q = Array.isArray(json?.quotes) ? json.quotes : [];
                                    const mapped: StockItem[] = q.map((x: any) => ({
                                      symbol: String(x.symbol || ""),
                                      exchange: String(x.exchange || "NSE"),
                                      price: Number(x.price || 0),
                                      changePct: Number(x.changePct || 0),
                                    }));
                                    setSymbols(mapped);
                                  }
                                }
                              } catch (err) {
                                alert(err instanceof Error ? err.message : "Failed to add symbol");
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                      Stocks in Watchlist
                    </label>
                    <div className="space-y-1">
                      {symbols.map((s) => (
                        <div
                          key={s.symbol}
                          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-900 rounded"
                        >
                          <span className="text-sm">{s.symbol}</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={async () => {
                              if (!uid || !editPanelId) return;
                              try {
                                await watchlistService.removeSymbol(uid, editPanelId, s.symbol);
                                setSymbols(symbols.filter((sym) => sym.symbol !== s.symbol));
                              } catch (err) {
                                alert(err instanceof Error ? err.message : "Failed to remove symbol");
                              }
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {symbols.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No stocks in this watchlist
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search Bar */}
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowAddStockModal(true)}
                    className="whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Stock
                  </Button>
                </div>
              </div>

              {/* Stock List */}
              <div className="flex-1 overflow-y-auto">
                {loadingSymbols && (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-sm text-gray-500">Loading…</span>
                  </div>
                )}
                {!loadingSymbols && filteredSymbols.length > 0 && (
                  <div>
                    {filteredSymbols.map((s) => (
                      <StockCard key={s.symbol} item={s} />
                    ))}
                  </div>
                )}
                {!loadingSymbols && filteredSymbols.length === 0 && symbols.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        No stocks in this watchlist
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                        Add stocks to track their prices and performance
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowAddStockModal(true)}
                      className="whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Your First Stock
                    </Button>
                  </div>
                )}
                {!loadingSymbols && filteredSymbols.length === 0 && symbols.length > 0 && (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No stocks match your search
                  </div>
                )}
              </div>

              {/* Options Quick List Button */}
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    // Options quick list functionality
                    alert("Options Quick List feature coming soon!");
                  }}
                >
                  OPTIONS QUICK LIST
                </Button>
              </div>
            </div>
          )}
        </aside>

        {/* Main Chart Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
          <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
            {(["Chart", "Overview"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setMainTab(t)}
                className={`relative -mb-px pb-2 text-sm font-medium transition-colors ${
                  mainTab === t
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                role="tab"
                aria-selected={mainTab === t}
              >
                {t}
                {mainTab === t && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {mainTab === "Chart" ? (
              selectedSymbol ? (
                <WatchlistChart 
                  key={`${selectedSymbol}-${selectedExchange}-${chartKey}`} 
                  symbol={selectedSymbol} 
                  exchange={selectedExchange} 
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 dark:text-gray-400">
                    Select a stock from watchlist to view chart
                  </p>
                </div>
              )
            ) : (
              <MarketOverview />
            )}
          </div>
        </main>
      </div>

      {/* Create Watchlist Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-md shadow-lg border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b">
              <h2 className="text-sm font-semibold">Create Watchlist</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowCreate(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-3 space-y-3">
              <label className="text-xs text-gray-600 dark:text-gray-400">
                Watchlist name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                placeholder="Enter name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
              {error && (
                <div className="text-xs text-red-600">{error}</div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowAddStockModal(false);
            setNewStockSymbol("");
          }}
        >
          <div
            className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-md shadow-lg border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b">
              <h2 className="text-sm font-semibold">Add Stock</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setShowAddStockModal(false);
                  setNewStockSymbol("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-3 space-y-3">
              <label className="text-xs text-gray-600 dark:text-gray-400">
                Stock Symbol
              </label>
              <input
                value={newStockSymbol}
                onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                placeholder="Enter symbol (e.g., RELIANCE, TCS)"
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newStockSymbol.trim() && !addingStock) {
                    await handleAddStock();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Enter the stock symbol in uppercase (e.g., RELIANCE, TCS, INFY)
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddStockModal(false);
                    setNewStockSymbol("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddStock}
                  disabled={addingStock || !newStockSymbol.trim()}
                >
                  {addingStock ? "Adding…" : "Add Stock"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
