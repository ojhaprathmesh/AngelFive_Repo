/**
 * mlFetch.ts
 *
 * Central fetch wrapper for all backend → ML service calls.
 *
 * Render's free tier spins down idle services. When a cold-start happens the
 * first request gets a 503 while the container boots (~20-40 s). This wrapper
 * retries with staggered delays (10 s → 20 s → 30 s = 60 s total budget)
 * before giving up, so a single cold-start is transparently handled for every
 * endpoint in dsfm.ts without any per-route boilerplate.
 *
 * Usage (drop-in replacement for fetch):
 *
 *   import { mlFetch } from "../utils/mlFetch";
 *
 *   const mlResp = await mlFetch(`${mlServiceUrl}/dsfm/arima`, {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ returns: logReturns, order }),
 *   });
 *
 *   if (mlResp.ok) { ... }
 *
 * Throws an MlServiceError on final failure so callers can catch and return
 * a consistent 503 response.
 */

const RETRY_DELAYS_MS = [10_000, 20_000, 30_000]; // 10 s, 20 s, 30 s

export class MlServiceError extends Error {
    constructor(
        message: string,
        public readonly lastStatus?: number,
    ) {
        super(message);
        this.name = "MlServiceError";
    }
}

/**
 * Fetches a ML-service endpoint, retrying up to 3 times on network errors or
 * non-2xx responses (specifically 503 / 502 which signal a cold-start).
 *
 * Non-retryable HTTP errors (4xx except 429) are returned immediately —
 * there is no point retrying a bad-request or auth error.
 */
export async function mlFetch(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    // Ensure Content-Type is always set for POST/PUT bodies
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
    };

    const reqOptions: RequestInit = { ...options, headers };

    let lastError: Error = new MlServiceError("ML service unavailable");
    let lastStatus: number | undefined;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
            const resp = await fetch(url, reqOptions);

            if (resp.ok) {
                return resp;
            }

            lastStatus = resp.status;

            // Don't retry client errors (except 429 Too Many Requests)
            if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
                const body = await resp.text();
                throw new MlServiceError(
                    `ML service returned ${resp.status}: ${body}`,
                    resp.status,
                );
            }

            // Server error (5xx) or 429 — worth retrying
            lastError = new MlServiceError(
                `ML service returned HTTP ${resp.status}`,
                resp.status,
            );
            console.warn(
                `[mlFetch] Attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1} failed with HTTP ${resp.status} for ${url}`,
            );
        } catch (e: any) {
            // Re-throw non-retryable MlServiceError immediately (4xx above)
            if (e instanceof MlServiceError && e.lastStatus && e.lastStatus >= 400 && e.lastStatus < 500 && e.lastStatus !== 429) {
                throw e;
            }
            lastError = e instanceof Error ? e : new Error(String(e));
            console.warn(
                `[mlFetch] Attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1} threw: ${lastError.message} for ${url}`,
            );
        }

        if (attempt < RETRY_DELAYS_MS.length) {
            const delay = RETRY_DELAYS_MS[attempt];
            console.log(`[mlFetch] Retrying in ${delay / 1000}s... (${url})`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    throw new MlServiceError(
        `ML service unavailable after ${RETRY_DELAYS_MS.length + 1} attempts (delays: ${RETRY_DELAYS_MS.map((d) => d / 1000 + "s").join(", ")}). Last error: ${lastError.message}`,
        lastStatus,
    );
}
