import { Request, Response, Router } from "express";

import { firebaseFirestore } from "../config/firebase";
import { logger } from "../lib/logger";
import { verifyToken } from "../middleware/auth";
import { notificationService } from "../services/notification";

const router: Router = Router();

// Get recent notifications
router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const queryLimit = parseInt(req.query.limit as string) || 20;
    const archived = req.query.archived === "true";

    const notificationsRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("notifications");

    // Query without orderBy to avoid needing a composite index
    const snap = await notificationsRef.where("archived", "==", archived).get();

    const notifications = snap.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => {
        // Sort by createdAt descending (handle Firestore Timestamps)
        const aTime =
          a.createdAt?.toMillis?.() || a.createdAt?._seconds * 1000 || 0;
        const bTime =
          b.createdAt?.toMillis?.() || b.createdAt?._seconds * 1000 || 0;
        return bTime - aTime;
      })
      .slice(0, queryLimit);

    return res.json({ status: "success", notifications });
  } catch (error: any) {
    logger.error(
      { err: error },
      "[Notifications] Error fetching notifications:",
    );
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// Get notification stats (unread count)
router.get("/stats", verifyToken, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const statsRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("notification_stats")
      .doc("current");

    const doc = await statsRef.get();
    if (!doc.exists) {
      return res.json({
        status: "success",
        stats: { unreadCount: 0, lastNotificationAt: null },
      });
    }

    return res.json({ status: "success", stats: doc.data() });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// Mark a notification as read
router.post("/:id/read", verifyToken, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const { id } = req.params;
    await notificationService.markAsRead(uid, id);
    return res.json({ status: "success" });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// Mark all as read
router.post(
  "/mark-all-read",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const uid = (req as any).uid;
      await notificationService.markAllAsRead(uid);
      return res.json({ status: "success" });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  },
);

// Archive a notification
router.delete("/:id", verifyToken, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const { id } = req.params;
    await notificationService.archiveNotification(uid, id);
    return res.json({ status: "success" });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// Real-time stream for notifications (SSE fallback if frontend doesn't use Firestore directly)
router.get("/stream", verifyToken, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const notificationsRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("notifications");

    const statsRef = firebaseFirestore
      .collection("users")
      .doc(uid)
      .collection("notification_stats")
      .doc("current");

    // Listen for stats changes (unread count)
    const unsubscribeStats = statsRef.onSnapshot((doc) => {
      if (doc.exists) {
        res.write(
          `data: ${JSON.stringify({ type: "stats", stats: doc.data() })}\n\n`,
        );
      }
    });

    // Listen for recent notifications (no orderBy to avoid needing composite index)
    const unsubscribeNotifications = notificationsRef
      .where("archived", "==", false)
      .onSnapshot((snap) => {
        const notifications = snap.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a: any, b: any) => {
            const aTime =
              a.createdAt?.toMillis?.() || a.createdAt?._seconds * 1000 || 0;
            const bTime =
              b.createdAt?.toMillis?.() || b.createdAt?._seconds * 1000 || 0;
            return bTime - aTime;
          })
          .slice(0, 10);
        res.write(
          `data: ${JSON.stringify({ type: "notifications", notifications })}\n\n`,
        );
      });

    req.on("close", () => {
      unsubscribeStats();
      unsubscribeNotifications();
    });
    return;
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
