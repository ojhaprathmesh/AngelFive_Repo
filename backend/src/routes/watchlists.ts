import { Request, Response, Router } from "express";

import { verifyToken as verifyTokenMiddleware } from "../middleware/auth";
import {
  watchlistService,
  WatchlistServiceError,
} from "../services/watchlist.service";
import { getAuthUid } from "../types/auth";

const router: Router = Router();

function handleError(res: Response, error: unknown) {
  if (error instanceof WatchlistServiceError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  const message = (error as Error)?.message || "Internal server error";
  return res.status(500).json({ status: "error", message });
}

// SSE real-time stream of watchlists
router.get("/stream", verifyTokenMiddleware, (req: Request, res: Response) => {
  try {
    const uid = getAuthUid(req);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const unsubscribe = watchlistService.subscribeToStream(
      uid,
      (payload: string) => {
        res.write(payload);
      },
    );

    req.on("close", () => {
      unsubscribe();
    });
  } catch (error: unknown) {
    handleError(res, error);
  }
});

// List all watchlists
router.get("/", verifyTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const items = await watchlistService.listWatchlists(getAuthUid(req));
    res.json({ items });
  } catch (error: unknown) {
    handleError(res, error);
  }
});

// Create a new watchlist
router.post("/", verifyTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await watchlistService.createWatchlist(
      getAuthUid(req),
      req.body?.name,
    );
    res.json({ status: "success", id: result.id });
  } catch (error: unknown) {
    handleError(res, error);
  }
});

// Rename a watchlist
router.patch(
  "/:id",
  verifyTokenMiddleware,
  async (req: Request, res: Response) => {
    try {
      await watchlistService.renameWatchlist(
        getAuthUid(req),
        req.params.id,
        req.body?.name,
      );
      res.json({ status: "success" });
    } catch (error: unknown) {
      handleError(res, error);
    }
  },
);

// Delete a watchlist
router.delete(
  "/:id",
  verifyTokenMiddleware,
  async (req: Request, res: Response) => {
    try {
      await watchlistService.deleteWatchlist(getAuthUid(req), req.params.id);
      res.json({ status: "success" });
    } catch (error: unknown) {
      handleError(res, error);
    }
  },
);

// Reorder watchlists
router.post(
  "/reorder",
  verifyTokenMiddleware,
  async (req: Request, res: Response) => {
    try {
      await watchlistService.reorderWatchlists(
        getAuthUid(req),
        req.body?.order,
      );
      res.json({ status: "success" });
    } catch (error: unknown) {
      handleError(res, error);
    }
  },
);

// Get symbol counts per watchlist
router.get(
  "/counts",
  verifyTokenMiddleware,
  async (req: Request, res: Response) => {
    try {
      const counts = await watchlistService.getCounts(getAuthUid(req));
      res.json({ counts });
    } catch (error: unknown) {
      handleError(res, error);
    }
  },
);

// Get symbols inside a watchlist
router.get(
  "/:id/symbols",
  verifyTokenMiddleware,
  async (req: Request, res: Response) => {
    try {
      const symbols = await watchlistService.listSymbols(
        getAuthUid(req),
        req.params.id,
      );
      res.json({ symbols });
    } catch (error: unknown) {
      handleError(res, error);
    }
  },
);

// Add symbol to a watchlist
router.post(
  "/:id/symbols",
  verifyTokenMiddleware,
  async (req: Request, res: Response) => {
    try {
      const result = await watchlistService.addSymbol(
        getAuthUid(req),
        req.params.id,
        req.body?.symbol,
        req.body?.exchange,
      );
      res.json({ status: "success", id: result.id });
    } catch (error: unknown) {
      handleError(res, error);
    }
  },
);

// Remove symbol from a watchlist
router.delete(
  "/:id/symbols/:symbolId",
  verifyTokenMiddleware,
  async (req: Request, res: Response) => {
    try {
      await watchlistService.removeSymbol(
        getAuthUid(req),
        req.params.id,
        req.params.symbolId,
      );
      res.json({ status: "success" });
    } catch (error: unknown) {
      handleError(res, error);
    }
  },
);

export default router;
