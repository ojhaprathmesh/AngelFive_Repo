// frontend/app/dashboard/market/view-all/page.tsx
import Link from "next/link";
import BackButton from "./back-button";

type Section =
  | "most-bought"
  | "top-movers"
  | "top-performers"
  | "technical-screeners"
  | "pocket-friendly";

const SECTION_LABELS: Record<Section, string> = {
  "most-bought": "Most Bought Stocks",
  "top-movers": "Top Movers",
  "top-performers": "Top Performers",
  "technical-screeners": "Technical Screeners",
  "pocket-friendly": "Pocket Friendly",
};

interface QuoteLike {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
}

export default async function ViewAllPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: Section }>;
}) {
  const sp = await searchParams;
  const section = (sp?.section || "most-bought") as Section;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const resp = await fetch(`${apiBase}/api/market/discovery`, {
    cache: "no-store",
  });
  const data = resp.ok ? await resp.json() : {};

  let items: QuoteLike[] = [];
  if (section === "most-bought") items = data.mostBought || [];
  else if (section === "top-movers")
    items = [...(data.topGainers || []), ...(data.topLosers || [])];
  else if (section === "pocket-friendly")
    items = [
      ...(data.pocketFriendly?.under50 || []),
      ...(data.pocketFriendly?.under100 || []),
      ...(data.pocketFriendly?.under200 || []),
    ];

  return (
    <div className="w-full p-4 space-y-4">
      {/* Header with back navigation */}
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <Link href="/dashboard/market" className="hover:underline">
              Market
            </Link>
            {" / "}
            {SECTION_LABELS[section]}
          </p>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {SECTION_LABELS[section]}
          </h2>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.length === 0 && (
          <p className="text-sm text-gray-500 col-span-full">
            No data available.
          </p>
        )}
        {items.map((q, i) => {
          const change = Number(q.regularMarketChangePercent || 0);
          const isUp = change >= 0;
          return (
            <div key={i} className="border rounded-lg p-3 space-y-1">
              <div className="text-sm font-semibold">{q.symbol}</div>
              <div className="text-sm">
                ₹{Number(q.regularMarketPrice || 0).toFixed(2)}
              </div>
              <div
                className={`text-xs font-medium ${isUp ? "text-green-600" : "text-red-600"}`}
              >
                {isUp ? "+" : ""}
                {change.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
