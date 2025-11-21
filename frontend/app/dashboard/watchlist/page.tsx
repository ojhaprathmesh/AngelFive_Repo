"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { watchlistService, type WatchlistItem } from "@/lib/watchlists";
import { Button } from "@/components/ui/button";
import { Settings, Plus, GripVertical, Pencil, Trash2, Check, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

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
      await watchlistService.reorder(uid, current.map((w) => w.id));
    } catch {}
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = async () => {
    if (!editingId || !uid) return;
    try {
      setSavingEdit(true);
      const trimmed = editName.trim();
      if (!trimmed) return;
      const exists = watchlists.some((w) => w.name.toLowerCase() === trimmed.toLowerCase() && w.id !== editingId);
      if (exists) return;
      await watchlistService.rename(uid, editingId, trimmed);
      setEditingId(null);
      setEditName("");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreate = async () => {
    if (!uid) return;
    try {
      setError(null);
      setCreating(true);
      const trimmed = newName.trim();
      if (!trimmed) throw new Error("Name is required");
      const exists = watchlists.some((w) => w.name.toLowerCase() === trimmed.toLowerCase());
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
      <aside className="flex-1 lg:flex-[1] min-w-0 space-y-6 h-full w-full p-4 bg-white dark:bg-gray-800 rounded-sm shadow-[2px] border overflow-hidden">
        <div className="flex items-center justify-between">
          <div ref={tabsRef} className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap pr-2" role="tablist" aria-label="Watchlists">
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
            <DropdownMenu open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); if (!open) { setEditingId(null); setEditName(""); } }}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Settings" title="Settings">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[460px] p-1">
                <div className="text-xs px-1 py-0.5 font-medium">Watchlists</div>
                <div className="space-y-1">
                  {numberedTabs.map((t) => {
                    const wl = watchlists.find((w) => w.id === t.id)!;
                    const isEditing = editingId === wl.id;
                    return (
                      <div
                        key={wl.id}
                        className="grid grid-cols-[22px_18px_1fr_32px_32px_32px] items-center h-7 rounded cursor-grab hover:bg-accent/30 gap-1"
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(wl.id);
                          setEditingId(null);
                          setEditName("");
                          e.dataTransfer.setData("text/plain", wl.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromId = draggingId || e.dataTransfer.getData("text/plain");
                          const toId = wl.id;
                          setDraggingId(null);
                          if (fromId && fromId !== toId) applyReorder(fromId, toId);
                        }}
                      >
                        <div className="text-[11px] text-muted-foreground px-1">{t.number}</div>
                        <div className="flex items-center justify-center">
                          <GripVertical className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex items-center px-1 relative">
                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full rounded-md border bg-background px-2 h-6 text-[12px] pr-10"
                            />
                          ) : (
                            <span className="text-[12px] truncate">{wl.name}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground px-1">
                          {(counts[wl.id] ?? 0).toString()}
                        </div>
                        <div className="flex items-center justify-center">
                          {isEditing ? (
                            <Button variant="ghost" size="icon-sm" disabled={savingEdit} onClick={saveEdit} aria-label="Save" onMouseDown={(e) => e.stopPropagation()}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon-sm" onClick={() => startEdit(wl.id, wl.name)} aria-label="Edit" onMouseDown={(e) => e.stopPropagation()}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          {isEditing ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Cancel"
                              onClick={() => { setEditingId(null); setEditName(""); }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete"
                              onClick={async () => {
                                if (!uid) return;
                                const ok = window.confirm(`Delete watchlist "${wl.name}"?`);
                                if (!ok) return;
                                try {
                                  await watchlistService.remove(uid, wl.id);
                                } catch {}
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 rounded-md border bg-gray-50 dark:bg-gray-900 p-3 transition-all">
          {selectedId ? (
            <div className="text-sm text-gray-700 dark:text-gray-300">Selected watchlist #{numberedTabs.find((t) => t.id === selectedId)?.number}</div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="create-watchlist-title">
            <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-md shadow-lg border">
              <div className="flex items-center justify-between p-3 border-b">
                <h2 id="create-watchlist-title" className="text-sm font-semibold">Create Watchlist</h2>
                <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setShowCreate(false)}>×</Button>
              </div>
              <div className="p-3 space-y-3">
                <label className="text-xs text-gray-600 dark:text-gray-400" htmlFor="wl-name">Watchlist name</label>
                <input
                  id="wl-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                  placeholder="Enter name"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button variant="default" size="sm" onClick={handleCreate} disabled={creating} aria-busy={creating}>
                    {creating ? "Creating…" : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-4 lg:flex-[4] space-y-6 h-full w-full p-4 bg-white dark:bg-gray-800 rounded-sm shadow-[2px] border"></main>
    </div>
  );
}
