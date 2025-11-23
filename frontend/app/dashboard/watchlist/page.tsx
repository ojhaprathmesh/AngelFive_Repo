"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { watchlistService, type WatchlistItem } from "@/lib/watchlists";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TrendingUp, TrendingDown } from "lucide-react";
import ChartComponent from "@/components/chart-component";
import { MarketOverview } from "@/components/market-overview";

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

  type StockItem = {
    symbol: string;
    exchange: string;
    price: number;
    changePct: number;
  };

  function StockCard({ item }: { item: StockItem }) {
    const positive = item.changePct >= 0;
    const PriceIcon = positive ? TrendingUp : TrendingDown;
    const color = positive ? "text-green-600" : "text-red-600";
    return (
      <div className="flex flex-col px-2 py-2 border-b last:border-b-0">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{item.symbol}</span>
            <span className="text-xs text-muted-foreground">
              {item.exchange}
            </span>
          </div>
          <div className={`flex items-center gap-1 ${color}`}>
            <span className="text-sm font-semibold">
              {item.price.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <PriceIcon className="h-4 w-4" />
          </div>
        </div>
        <div className={`${color} text-xs`}>{`${item.changePct.toFixed(
          2
        )}%`}</div>
      </div>
    );
  }

  useEffect(() => {
    if (!uid || !selectedId) return;
    (async () => {
      try {
        setLoadingSymbols(true);
        setSymbols([]);
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
            setSymbols(mapped);
          } else {
            setSymbols([]);
          }
        } else {
          setSymbols([]);
        }
      } catch {
        setSymbols([]);
      } finally {
        setLoadingSymbols(false);
      }
    })();
  }, [uid, selectedId]);

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
    <div className="flex justify-center space-x-2 p-2 h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
      <aside className="flex-1 lg:flex-[1] min-w-0 space-y-6 h-full w-full p-2 bg-white dark:bg-gray-800 rounded-sm shadow-[2px] border overflow-hidden">
        {editPanelId ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back"
                title="Back"
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
                />
              ) : (
                <span className="text-sm font-medium truncate">
                  {editPanelName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 justify-end">
              {panelEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={savePanelRename}
                    disabled={panelSaving}
                    aria-label="Save"
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
                    aria-label="Cancel"
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
        ) : (
          <div className="flex items-center justify-between">
            <div
              ref={tabsRef}
              className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap pr-2"
              role="tablist"
              aria-label="Watchlists"
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
                  onClick={() => setSelectedId(tab.id)}
                  role="tab"
                  aria-selected={selectedId === tab.id}
                  className="w-8 h-8 p-0 transition-all duration-200"
                >
                  {tab.number}
                </Button>
              ))}
            </div>

            <div className="flex-shrink-0 flex items-center gap-2">
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
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Settings"
                    title="Settings"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent asChild>
                  <div
                    className="w-[275px] p-1"
                    style={{ position: "fixed", left: 0, top: 0 }}
                  >
                    <div className="text-xs px-1 py-0.5 font-medium">
                      Watchlists
                    </div>
                    <div className="space-y-1">
                      {numberedTabs.map((t) => {
                        const wl = watchlists.find((w) => w.id === t.id)!;
                        return (
                          <div
                            key={wl.id}
                            className="grid grid-cols-[22px_18px_1fr_32px_32px_32px] items-center h-7 rounded cursor-grab hover:bg-accent/30 gap-1"
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
                              <span className="text-[12px] truncate">
                                {wl.name}
                              </span>
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
                                    `Delete watchlist \"${wl.name}\"?`
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
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <div
          className={`flex-1 rounded-md border bg-gray-50 dark:bg-gray-900 transition-all ${
            symbols.length === 0 ? "p-3" : ""
          }`}
        >
          {selectedId ? (
            <div className="space-y-2">
              <div className="w-full max-w-md">
                {loadingSymbols && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="animate-pulse">Loading…</span>
                  </div>
                )}
                {!loadingSymbols &&
                  symbols.length > 0 &&
                  symbols.map((s) => <StockCard key={s.symbol} item={s} />)}
                {!loadingSymbols && symbols.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    No stocks in this watchlist
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Select a watchlist</div>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-600" role="alert">
            {error}
          </div>
        )}

        {showCreate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-watchlist-title"
          >
            <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-md shadow-lg border">
              <div className="flex items-center justify-between p-3 border-b">
                <h2
                  id="create-watchlist-title"
                  className="text-sm font-semibold"
                >
                  Create Watchlist
                </h2>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close"
                  onClick={() => setShowCreate(false)}
                >
                  ×
                </Button>
              </div>
              <div className="p-3 space-y-3">
                <label
                  className="text-xs text-gray-600 dark:text-gray-400"
                  htmlFor="wl-name"
                >
                  Watchlist name
                </label>
                <input
                  id="wl-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                  placeholder="Enter name"
                />
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
                    aria-busy={creating}
                  >
                    {creating ? "Creating…" : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-3 lg:flex-[3] h-full w-full p-4 bg-white dark:bg-gray-800 rounded-sm shadow-[2px] border flex flex-col gap-4">
        <div className="flex items-center gap-6 border-b pb-0 mb-4">
          {(["Chart", "Overview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className={`relative -mb-px pb-2 text-sm font-medium ${
                mainTab === t ? "text-blue-600" : "text-foreground"
              }`}
              role="tab"
              aria-selected={mainTab === t}
            >
              {t}
              {mainTab === t && (
                <span className="absolute left-0 right-0 bottom-[-2px] h-[2px] bg-blue-600" />
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          {mainTab === "Chart" ? <ChartComponent /> : <MarketOverview />}
        </div>
      </main>
    </div>
  );
}
