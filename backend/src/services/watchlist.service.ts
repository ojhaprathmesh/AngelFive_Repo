import {
  WatchlistDoc,
  watchlistRepository,
  WatchlistSymbol,
} from "../repositories/watchlist.repository";
import { appEvents, AppEventType } from "./event-emitter";

export class WatchlistServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "WatchlistServiceError";
  }
}

export function sortWatchlist(
  items: WatchlistDoc[],
): Omit<WatchlistDoc, "_orderIndex">[] {
  return items
    .sort((a, b) => {
      const aDef = a.name.toLowerCase() === "default" ? -1 : 0;
      const bDef = b.name.toLowerCase() === "default" ? -1 : 0;
      if (aDef !== bDef) return aDef - bDef;
      const aOrd = typeof a._orderIndex === "number" ? a._orderIndex : null;
      const bOrd = typeof b._orderIndex === "number" ? b._orderIndex : null;
      if (aOrd !== null || bOrd !== null) {
        if (aOrd === null) return 1;
        if (bOrd === null) return -1;
        return aOrd - bOrd;
      }
      return a.createdAt.toMillis() - b.createdAt.toMillis();
    })
    .map(({ id, name, createdAt }) => ({ id, name, createdAt }));
}

export class WatchlistService {
  constructor(private repo = watchlistRepository) {}

  async listWatchlists(
    userId: string,
  ): Promise<Omit<WatchlistDoc, "_orderIndex">[]> {
    const items = await this.repo.getUserWatchlists(userId);
    return sortWatchlist(items);
  }

  async createWatchlist(
    userId: string,
    rawName: string,
  ): Promise<{ id: string }> {
    const trimmed = (rawName || "").trim();
    if (!trimmed) {
      throw new WatchlistServiceError("Name is required", 400);
    }

    const existing = await this.repo.findByName(userId, trimmed);
    if (existing) {
      throw new WatchlistServiceError(
        "A watchlist with this name already exists",
        409,
      );
    }

    const id = await this.repo.createWatchlist(userId, trimmed);

    appEvents.emit(AppEventType.WATCHLIST_CREATED, {
      userId,
      type: AppEventType.WATCHLIST_CREATED,
      title: "Watchlist Created",
      message: `New watchlist "${trimmed}" has been created.`,
      category: "watchlist",
      priority: "low",
      action: { type: "navigate", url: "/dashboard/watchlist" },
    });

    return { id };
  }

  async renameWatchlist(
    userId: string,
    id: string,
    rawName: string,
  ): Promise<void> {
    const cleanId = String(id || "").trim();
    const trimmed = (rawName || "").trim();

    if (!cleanId) {
      throw new WatchlistServiceError("Invalid id", 400);
    }
    if (!trimmed) {
      throw new WatchlistServiceError("Name is required", 400);
    }

    const existing = await this.repo.findByName(userId, trimmed);
    if (existing && existing.id !== cleanId) {
      throw new WatchlistServiceError(
        "A watchlist with this name already exists",
        409,
      );
    }

    await this.repo.renameWatchlist(userId, cleanId, trimmed);
  }

  async deleteWatchlist(userId: string, id: string): Promise<void> {
    const cleanId = String(id || "").trim();
    if (!cleanId) {
      throw new WatchlistServiceError("Invalid id", 400);
    }
    await this.repo.deleteWatchlist(userId, cleanId);
  }

  async reorderWatchlists(userId: string, order: unknown): Promise<void> {
    const cleanOrder = Array.isArray(order)
      ? (order as string[]).map(String)
      : [];
    if (cleanOrder.length === 0) {
      throw new WatchlistServiceError("Order is required", 400);
    }
    await this.repo.reorderWatchlists(userId, cleanOrder);
  }

  async getCounts(userId: string): Promise<Record<string, number>> {
    return this.repo.getWatchlistCounts(userId);
  }

  async listSymbols(
    userId: string,
    watchlistId: string,
  ): Promise<WatchlistSymbol[]> {
    const cleanId = String(watchlistId || "").trim();
    if (!cleanId) {
      throw new WatchlistServiceError("Invalid id", 400);
    }
    return this.repo.getSymbols(userId, cleanId);
  }

  async addSymbol(
    userId: string,
    watchlistId: string,
    rawSymbol: string,
    rawExchange: string,
  ): Promise<{ id: string }> {
    const cleanId = String(watchlistId || "").trim();
    const symbol = String(rawSymbol || "")
      .trim()
      .toUpperCase();
    const exchange = String(rawExchange || "NSE")
      .trim()
      .toUpperCase();

    if (!cleanId) {
      throw new WatchlistServiceError("Invalid watchlist id", 400);
    }
    if (!symbol) {
      throw new WatchlistServiceError("Symbol is required", 400);
    }

    const alreadyExists = await this.repo.hasSymbol(userId, cleanId, symbol);
    if (alreadyExists) {
      throw new WatchlistServiceError("Symbol already in watchlist", 409);
    }

    await this.repo.addSymbol(userId, cleanId, symbol, exchange);

    appEvents.emit(AppEventType.WATCHLIST_SYMBOL_ADDED, {
      userId,
      type: AppEventType.WATCHLIST_SYMBOL_ADDED,
      title: "Symbol Added",
      message: `${symbol} added to your watchlist.`,
      category: "watchlist",
      priority: "low",
      metadata: { symbol, watchlistId: cleanId },
    });

    return { id: symbol };
  }

  async removeSymbol(
    userId: string,
    watchlistId: string,
    symbolId: string,
  ): Promise<void> {
    const cleanId = String(watchlistId || "").trim();
    const cleanSymbolId = String(symbolId || "").trim();

    if (!cleanId || !cleanSymbolId) {
      throw new WatchlistServiceError("Invalid id", 400);
    }

    await this.repo.removeSymbol(userId, cleanId, cleanSymbolId);
  }

  subscribeToStream(
    userId: string,
    onData: (payload: string) => void,
  ): () => void {
    return this.repo.subscribeToWatchlists(
      userId,
      async (snap) => {
        if (snap.empty) {
          try {
            await this.repo.ensureDefaultWatchlist(userId);
          } catch {
            // Ignore error if already concurrently initialized
          }
          return;
        }
        const items = this.repo.mapWatchlistDocs(snap.docs);
        const sorted = sortWatchlist(items);
        onData(`data: ${JSON.stringify({ items: sorted })}\n\n`);
      },
      () => {
        // Stream subscription error handler
      },
    );
  }
}

export const watchlistService = new WatchlistService();
