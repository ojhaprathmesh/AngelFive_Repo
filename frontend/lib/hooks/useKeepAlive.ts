/**
 * useKeepAlive.ts
 *
 * Prevents Render's free-tier spin-down by pinging the backend /health
 * endpoint every 10 minutes while the frontend is active. The backend's
 * /health handler is responsible for internally forwarding that ping to
 * the ML service, so a single frontend interval keeps the entire stack warm.
 *
 * Only runs while the browser tab is open — this intentionally conserves
 * Render free-tier hours when no user is active.
 *
 * Usage — call once at the app root (e.g. App.tsx):
 *
 *   import { useKeepAlive } from "../hooks/useKeepAlive";
 *
 *   export default function App() {
 *     useKeepAlive();
 *     ...
 *   }
 */

import { useEffect } from "react";

const BACKEND_HEALTH_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/health`;
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function pingBackend(): Promise<void> {
    try {
        const resp = await fetch(BACKEND_HEALTH_URL, { method: "GET" });
        if (!resp.ok) {
            console.warn(`[health] Backend health check responded with HTTP ${resp.status}`);
        } else {
            console.log("[health] Backend pinged successfully");
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn(`[health] Backend health check failed: ${message}`);
    }
}

export function useKeepAlive(): void {
    useEffect(() => {
        /* Ping immediately on mount so the service is warm as soon as 
        the user opens the app, then keep pinging on the interval.*/
        void pingBackend();

        const intervalId = setInterval(() => {
            void pingBackend();
        }, INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, []); // Run once — no deps, interval is self-contained
}
