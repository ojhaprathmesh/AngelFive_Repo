import { Router, Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { firebaseFirestore } from "../config/firebase";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const router: Router = Router();

const verifyToken = async (req: Request): Promise<string> => {
  const header = req.headers.authorization;
  const token =
    header && header.startsWith("Bearer ") ? header.slice(7) : undefined;
  const queryToken =
    typeof req.query.token === "string"
      ? (req.query.token as string)
      : undefined;
  const idToken = token || queryToken;
  if (!idToken) throw new Error("Missing token");
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded.uid;
};

router.get("/stream", async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = await verifyToken(req);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const colRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("watchlists");
    const unsubscribe = colRef
      .orderBy("createdAt", "asc")
      .onSnapshot(async (snap) => {
        if (snap.empty) {
          try {
            const defDoc = colRef.doc("default");
            await defDoc.set(
              { name: "Default", createdAt: FieldValue.serverTimestamp() },
              { merge: true },
            );
            const symCol = defDoc.collection("symbols");
            const symSnap = await symCol.limit(1).get();
            if (symSnap.empty) {
              const samples = [
                {
                  symbol: "IDEA",
                  exchange: "NSE",
                  ltp: 9.97,
                  changePct: -1.97,
                },
                {
                  symbol: "JIOFIN",
                  exchange: "NSE",
                  ltp: 253.4,
                  changePct: 0.85,
                },
                {
                  symbol: "TATASTEEL",
                  exchange: "NSE",
                  ltp: 132.75,
                  changePct: -0.62,
                },
                {
                  symbol: "TATAPOWER",
                  exchange: "NSE",
                  ltp: 108.9,
                  changePct: 1.25,
                },
                {
                  symbol: "YESBANK",
                  exchange: "NSE",
                  ltp: 22.15,
                  changePct: -0.35,
                },
              ];
              const batch = firebaseFirestore.batch();
              samples.forEach((s) => {
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
          } catch {}
          return;
        }
        const items = snap.docs.map((d) => {
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
          } as any;
        });
        const sorted = items
          .sort((a: any, b: any) => {
            const aDef = String(a.name).toLowerCase() === "default" ? -1 : 0;
            const bDef = String(b.name).toLowerCase() === "default" ? -1 : 0;
            if (aDef !== bDef) return aDef - bDef;
            const aOrd =
              typeof a._orderIndex === "number" ? a._orderIndex : null;
            const bOrd =
              typeof b._orderIndex === "number" ? b._orderIndex : null;
            if (aOrd !== null || bOrd !== null) {
              if (aOrd === null) return 1;
              if (bOrd === null) return -1;
              return aOrd - bOrd;
            }
            return a.createdAt.toMillis() - b.createdAt.toMillis();
          })
          .map((x: any) => ({
            id: x.id,
            name: x.name,
            createdAt: x.createdAt,
          }));
        res.write(`data: ${JSON.stringify({ items: sorted })}\n\n`);
      });

    req.on("close", () => {
      unsubscribe();
    });
  } catch (error: any) {
    res
      .status(401)
      .json({ status: "error", message: error.message || "Unauthorized" });
  }
});

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = await verifyToken(req);
    const colRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("watchlists");
    const snap = await colRef.orderBy("createdAt", "asc").get();
    if (snap.empty) {
      const defDoc = colRef.doc("default");
      await defDoc.set(
        { name: "Default", createdAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      const symCol = defDoc.collection("symbols");
      const symSnap = await symCol.limit(1).get();
      if (symSnap.empty) {
        const samples = [
          { symbol: "IDEA", exchange: "NSE", ltp: 9.97, changePct: -1.97 },
          { symbol: "JIOFIN", exchange: "NSE", ltp: 253.4, changePct: 0.85 },
          {
            symbol: "TATASTEEL",
            exchange: "NSE",
            ltp: 132.75,
            changePct: -0.62,
          },
          { symbol: "TATAPOWER", exchange: "NSE", ltp: 108.9, changePct: 1.25 },
          { symbol: "YESBANK", exchange: "NSE", ltp: 22.15, changePct: -0.35 },
        ];
        const batch = firebaseFirestore.batch();
        samples.forEach((s) => {
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
      const refreshed = await colRef.orderBy("createdAt", "asc").get();
      const items = refreshed.docs.map((d) => {
        const data = d.data() as { name: string; createdAt?: Timestamp };
        return {
          id: d.id,
          name: data.name,
          createdAt: (data.createdAt as Timestamp) || Timestamp.now(),
        };
      });
      res.json({ items });
      return;
    }
    const items = snap.docs.map((d) => {
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
      } as any;
    });
    const sorted = items
      .sort((a: any, b: any) => {
        const aDef = String(a.name).toLowerCase() === "default" ? -1 : 0;
        const bDef = String(b.name).toLowerCase() === "default" ? -1 : 0;
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
      .map((x: any) => ({ id: x.id, name: x.name, createdAt: x.createdAt }));
    res.json({ items: sorted });
  } catch (error: any) {
    res
      .status(401)
      .json({ status: "error", message: error.message || "Unauthorized" });
  }
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = await verifyToken(req);
    const name = (req.body?.name as string) || "";
    const trimmed = name.trim();
    if (!trimmed) {
      res.status(400).json({ status: "error", message: "Name is required" });
      return;
    }
    const colRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("watchlists");
    const exists = await colRef.where("name", "==", trimmed).limit(1).get();
    if (!exists.empty) {
      res.status(409).json({
        status: "error",
        message: "A watchlist with this name already exists",
      });
      return;
    }
    const doc = await colRef.add({
      name: trimmed,
      createdAt: FieldValue.serverTimestamp(),
    });
    res.json({ status: "success", id: doc.id });
  } catch (error: any) {
    res
      .status(401)
      .json({ status: "error", message: error.message || "Unauthorized" });
  }
});

router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = await verifyToken(req);
    const id = String(req.params.id || "");
    const name = (req.body?.name as string) || "";
    const trimmed = name.trim();
    if (!id) {
      res.status(400).json({ status: "error", message: "Invalid id" });
      return;
    }
    if (!trimmed) {
      res.status(400).json({ status: "error", message: "Name is required" });
      return;
    }
    const colRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("watchlists");
    const dup = await colRef.where("name", "==", trimmed).limit(1).get();
    if (!dup.empty) {
      const existsId = dup.docs[0].id;
      if (existsId !== id) {
        res.status(409).json({
          status: "error",
          message: "A watchlist with this name already exists",
        });
        return;
      }
    }
    await colRef
      .doc(id)
      .set(
        { name: trimmed, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    res.json({ status: "success" });
  } catch (error: any) {
    res
      .status(401)
      .json({ status: "error", message: error.message || "Unauthorized" });
  }
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = await verifyToken(req);
    const id = String(req.params.id || "");
    if (!id) {
      res.status(400).json({ status: "error", message: "Invalid id" });
      return;
    }
    const colRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("watchlists");
    await colRef.doc(id).delete();
    res.json({ status: "success" });
  } catch (error: any) {
    res
      .status(401)
      .json({ status: "error", message: error.message || "Unauthorized" });
  }
});

router.post("/reorder", async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = await verifyToken(req);
    const order = Array.isArray(req.body?.order)
      ? (req.body.order as string[])
      : [];
    if (order.length === 0) {
      res.status(400).json({ status: "error", message: "Order is required" });
      return;
    }
    const colRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("watchlists");
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
    res.json({ status: "success" });
  } catch (error: any) {
    res
      .status(401)
      .json({ status: "error", message: error.message || "Unauthorized" });
  }
});

router.get("/counts", async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = await verifyToken(req);
    const colRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("watchlists");
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
    res.json({ counts });
  } catch (error: any) {
    res
      .status(401)
      .json({ status: "error", message: error.message || "Unauthorized" });
  }
});

router.get(
  "/:id/symbols",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uid = await verifyToken(req);
      const id = String(req.params.id || "");
      if (!id) {
        res.status(400).json({ status: "error", message: "Invalid id" });
        return;
      }
      const colRef = firebaseFirestore
        .collection("users")
        .doc(uid)
        .collection("watchlists")
        .doc(id)
        .collection("symbols");
      const snap = await colRef.orderBy("createdAt", "asc").get();
      const symbols = snap.docs.map((d) => {
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
      res.json({ symbols });
    } catch (error: any) {
      res
        .status(401)
        .json({ status: "error", message: error.message || "Unauthorized" });
    }
  },
);

// Add symbol to watchlist
router.post(
  "/:id/symbols",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uid = await verifyToken(req);
      const id = String(req.params.id || "");
      const symbol = String(req.body?.symbol || "")
        .trim()
        .toUpperCase();
      const exchange = String(req.body?.exchange || "NSE")
        .trim()
        .toUpperCase();

      if (!id) {
        res
          .status(400)
          .json({ status: "error", message: "Invalid watchlist id" });
        return;
      }
      if (!symbol) {
        res
          .status(400)
          .json({ status: "error", message: "Symbol is required" });
        return;
      }

      const colRef = firebaseFirestore
        .collection("users")
        .doc(uid)
        .collection("watchlists")
        .doc(id)
        .collection("symbols");

      // Check if symbol already exists
      const existing = await colRef
        .where("symbol", "==", symbol)
        .limit(1)
        .get();
      if (!existing.empty) {
        res
          .status(409)
          .json({ status: "error", message: "Symbol already in watchlist" });
        return;
      }

      // Add symbol
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

      res.json({ status: "success", id: symbol });
    } catch (error: any) {
      res
        .status(401)
        .json({ status: "error", message: error.message || "Unauthorized" });
    }
  },
);

// Remove symbol from watchlist
router.delete(
  "/:id/symbols/:symbolId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uid = await verifyToken(req);
      const id = String(req.params.id || "");
      const symbolId = String(req.params.symbolId || "");

      if (!id || !symbolId) {
        res.status(400).json({ status: "error", message: "Invalid id" });
        return;
      }

      const colRef = firebaseFirestore
        .collection("users")
        .doc(uid)
        .collection("watchlists")
        .doc(id)
        .collection("symbols");
      await colRef.doc(symbolId).delete();

      res.json({ status: "success" });
    } catch (error: any) {
      res
        .status(401)
        .json({ status: "error", message: error.message || "Unauthorized" });
    }
  },
);

export default router;
