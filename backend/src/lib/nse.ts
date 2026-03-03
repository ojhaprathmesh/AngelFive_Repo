let cookieCache = "";
let cookieTime = 0;
const COOKIE_TTL_MS = 10 * 60 * 1000;

export async function getNSECookie(): Promise<string> {
    if (cookieCache && Date.now() - cookieTime < COOKIE_TTL_MS)
        return cookieCache;
    const resp = await fetch("https://www.nseindia.com/", {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    });
    const cookieHeader = resp.headers.get("set-cookie") || "";
    cookieCache = cookieHeader;
    cookieTime = Date.now();
    return cookieHeader;
}

export async function fetchNSEIndex(
    indexName: string = "NIFTY 500",
): Promise<any[]> {
    const cookie = await getNSECookie();
    const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`;
    const resp = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "application/json,text/plain,*/*",
            Referer:
                "https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY%20500",
            Cookie: cookie,
        },
    });
    if (!resp.ok) return [];
    const json: any = await resp.json();
    return json?.data || [];
}
