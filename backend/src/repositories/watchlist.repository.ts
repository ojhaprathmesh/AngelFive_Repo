import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { firebaseFirestore } from "../config/firebase";

export interface WatchlistDoc {
  id: string;
  name: string;
  createdAt: Timestamp;
  _orderIndex: number | null;
}

export interface WatchlistSymbol {
  id: string;
  symbol: string;
  exchange: string;
  ltp: number;
  changePct: number;
  createdAt: Timestamp;
}

export const DEFAULT_SAMPLE_SYMBOLS = [
  { symbol: "IDEA", exchange: "NSE", ltp: 9.97, changePct: -1.97 },
  { symbol: "JIOFIN", exchange: "NSE", ltp: 253.4, changePct: 0.85 },
  { symbol: "TATASTEEL", exchange: "NSE", ltp: 132.75, changePct: -0.62 },
  { symbol: "TATAPOWER", exchange: "NSE", ltp: 108.9, changePct: 1.25 },
  { symbol: "YESBANK", exchange: "NSE", ltp: 22.15, changePct: -0.35 },
];

export class WatchlistRepository {
  private getWatchlistsCollection(userId: string) {
    return firebaseFirestore
      .collection("users")
      .doc(userId)
      .collection("watchlists");
  }

  private getSymbolsCollection(userId: string, watchlistId: string) {
    return this.getWatchlistsCollection(userId)
      .doc(watchlistId)
      .collection("symbols");
  }

  mapWatchlistDocs(
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
  ): WatchlistDoc[] {
    return docs.map((d) => {
      const data = d.data() as {
        name: string;
        createdAt?: Timestamp;
        orderIndex?: number;
      };
      return {
        id: d.id,
        name: data.name,
        createdAt: (data.createdAt as Timestamp) || Timestamp.now(),
        _orderIndex:
          typeof data.orderIndex === "number" ? data.orderIndex : null,
      };
    });
  }

  async ensureDefaultWatchlist(userId: string): Promise<void> {
    const colRef = this.getWatchlistsCollection(userId);
    const defDoc = colRef.doc("default");
    await defDoc.set(
      { name: "Default", createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    const symCol = defDoc.collection("symbols");
    const symSnap = await symCol.limit(1).get();
    if (symSnap.empty) {
      const batch = firebaseFirestore.batch();
      DEFAULT_SAMPLE_SYMBOLS.forEach((s) => {
        const ref = symCol.doc(s.symbol);
        batch.set(
          ref,
          {
            symbol: s.symbol,
            exchange: s.exchange,
            ltp: s.ltp,
            changePct: s.changePct,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
      await batch.commit();
    }
  }

  async getUserWatchlists(userId: string): Promise<WatchlistDoc[]> {
    const colRef = this.getWatchlistsCollection(userId);
    const snap = await colRef.orderBy("createdAt", "asc").get();
    if (snap.empty) {
      await this.ensureDefaultWatchlist(userId);
      const refreshed = await colRef.orderBy("createdAt", "asc").get();
      return this.mapWatchlistDocs(refreshed.docs);
    }
    return this.mapWatchlistDocs(snap.docs);
  }

  async findByName(
    userId: string,
    name: string,
  ): Promise<{ id: string; name: string } | null> {
    const colRef = this.getWatchlistsCollection(userId);
    const snap = await colRef.where("name", "==", name).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, name: snap.docs[0].data().name };
  }

  async createWatchlist(userId: string, name: string): Promise<string> {
    const colRef = this.getWatchlistsCollection(userId);
    const doc = await colRef.add({
      name,
      createdAt: FieldValue.serverTimestamp(),
    });
    return doc.id;
  }

  async renameWatchlist(
    userId: string,
    id: string,
    name: string,
  ): Promise<void> {
    const colRef = this.getWatchlistsCollection(userId);
    await colRef.doc(id).set(
      {
        name,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  async deleteWatchlist(userId: string, id: string): Promise<void> {
    const colRef = this.getWatchlistsCollection(userId);
    await colRef.doc(id).delete();
  }

  async reorderWatchlists(userId: string, order: string[]): Promise<void> {
    const colRef = this.getWatchlistsCollection(userId);
    const batch = firebaseFirestore.batch();
    order.forEach((wid, idx) => {
      const ref = colRef.doc(String(wid));
      batch.set(
        ref,
        { orderIndex: idx, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });
    await batch.commit();
  }

  async getWatchlistCounts(userId: string): Promise<Record<string, number>> {
    const colRef = this.getWatchlistsCollection(userId);
    const lists = await colRef.get();
    const counts: Record<string, number> = {};
    await Promise.all(
      lists.docs.map(async (d) => {
        const sub = await colRef.doc(d.id).collection("symbols").limit(1).get();
        if (sub.empty) {
          counts[d.id] = 0;
        } else {
          const full = await colRef.doc(d.id).collection("symbols").get();
          counts[d.id] = full.size;
        }
      }),
    );
    return counts;
  }

  async getSymbols(
    userId: string,
    watchlistId: string,
  ): Promise<WatchlistSymbol[]> {
    const colRef = this.getSymbolsCollection(userId, watchlistId);
    const snap = await colRef.orderBy("createdAt", "asc").get();
    return snap.docs.map((d) => {
      const data = d.data() as {
        symbol: string;
        exchange?: string;
        ltp?: number;
        changePct?: number;
        createdAt?: Timestamp;
      };
      return {
        id: d.id,
        symbol: data.symbol,
        exchange: data.exchange || "NSE",
        ltp: typeof data.ltp === "number" ? data.ltp : 0,
        changePct: typeof data.changePct === "number" ? data.changePct : 0,
        createdAt: (data.createdAt as Timestamp) || Timestamp.now(),
      };
    });
  }

  async hasSymbol(
    userId: string,
    watchlistId: string,
    symbol: string,
  ): Promise<boolean> {
    const colRef = this.getSymbolsCollection(userId, watchlistId);
    const existing = await colRef.where("symbol", "==", symbol).limit(1).get();
    return !existing.empty;
  }

  async addSymbol(
    userId: string,
    watchlistId: string,
    symbol: string,
    exchange: string,
  ): Promise<void> {
    const colRef = this.getSymbolsCollection(userId, watchlistId);
    await colRef.doc(symbol).set(
      {
        symbol,
        exchange,
        ltp: 0,
        changePct: 0,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  async removeSymbol(
    userId: string,
    watchlistId: string,
    symbolId: string,
  ): Promise<void> {
    const colRef = this.getSymbolsCollection(userId, watchlistId);
    await colRef.doc(symbolId).delete();
  }

  subscribeToWatchlists(
    userId: string,
    onSnapshot: (snap: FirebaseFirestore.QuerySnapshot) => void,
    onError: (error: Error) => void,
  ): () => void {
    const colRef = this.getWatchlistsCollection(userId);
    return colRef.orderBy("createdAt", "asc").onSnapshot(onSnapshot, onError);
  }
}

export const watchlistRepository = new WatchlistRepository();
