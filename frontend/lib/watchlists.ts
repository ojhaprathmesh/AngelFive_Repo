import { auth } from "./firebase";
import { Timestamp } from "firebase/firestore";

export interface WatchlistItem {
  id: string;
  name: string;
  createdAt: Timestamp;
}

class WatchlistHttpService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BACKEND_URL || "";
  }

  subscribe(
    _uid: string,
    onUpdate: (items: WatchlistItem[]) => void,
    onError?: (error: string) => void,
  ): () => void {
    let es: EventSource | null = null;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken(true);
        const url = `${this.baseUrl}/api/watchlists/stream?token=${encodeURIComponent(String(token))}`;
        es = new EventSource(url);
        es.onmessage = (ev) => {
          try {
            const payload = JSON.parse(ev.data) as { items: WatchlistItem[] };
            onUpdate(payload.items || []);
          } catch {
            onError?.("Failed to parse update");
          }
        };
        es.onerror = () => {
          onError?.("Stream error");
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Authorization error";
        onError?.(msg);
      }
    })();
    return () => {
      es?.close();
    };
  }

  async create(_uid: string, name: string): Promise<void> {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Name is required");
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch(`${this.baseUrl}/api/watchlists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(token)}`,
      },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Failed to create watchlist");
    }
  }

  async rename(_uid: string, id: string, name: string): Promise<void> {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Name is required");
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch(
      `${this.baseUrl}/api/watchlists/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${String(token)}`,
        },
        body: JSON.stringify({ name: trimmed }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Failed to rename watchlist");
    }
  }

  async remove(_uid: string, id: string): Promise<void> {
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch(
      `${this.baseUrl}/api/watchlists/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${String(token)}`,
        },
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Failed to delete watchlist");
    }
  }

  async reorder(_uid: string, order: string[]): Promise<void> {
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch(`${this.baseUrl}/api/watchlists/reorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(token)}`,
      },
      body: JSON.stringify({ order }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Failed to reorder watchlists");
    }
  }

  async getCounts(_uid: string): Promise<Record<string, number>> {
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch(`${this.baseUrl}/api/watchlists/counts`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${String(token)}`,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Failed to load counts");
    }
    const json = await res.json().catch(() => ({ counts: {} }));
    return (json?.counts as Record<string, number>) || {};
  }

  async getSymbols(
    _uid: string,
    id: string,
  ): Promise<
    Array<{
      id: string;
      symbol: string;
      exchange: string;
      ltp: number;
      changePct: number;
    }>
  > {
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch(
      `${this.baseUrl}/api/watchlists/${encodeURIComponent(id)}/symbols`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${String(token)}`,
        },
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Failed to load symbols");
    }
    const json = await res.json().catch(() => ({ symbols: [] }));
    type ApiSymbol = {
      id?: string;
      symbol?: string;
      exchange?: string;
      ltp?: number;
      changePct?: number;
    };
    const symbols = (json?.symbols as Array<ApiSymbol>) || [];
    return symbols.map((s) => ({
      id: String(s.id || s.symbol || ""),
      symbol: String(s.symbol || ""),
      exchange: String(s.exchange || "NSE"),
      ltp: typeof s.ltp === "number" ? s.ltp : 0,
      changePct: typeof s.changePct === "number" ? s.changePct : 0,
    }));
  }

  async addSymbol(
    _uid: string,
    watchlistId: string,
    symbol: string,
    exchange: string = "NSE",
  ): Promise<void> {
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch(
      `${this.baseUrl}/api/watchlists/${encodeURIComponent(watchlistId)}/symbols`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${String(token)}`,
        },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          exchange: exchange.trim().toUpperCase(),
        }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Failed to add symbol");
    }
  }

  async removeSymbol(
    _uid: string,
    watchlistId: string,
    symbolId: string,
  ): Promise<void> {
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch(
      `${this.baseUrl}/api/watchlists/${encodeURIComponent(watchlistId)}/symbols/${encodeURIComponent(symbolId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${String(token)}`,
        },
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Failed to remove symbol");
    }
  }
}

export const watchlistService = new WatchlistHttpService();
