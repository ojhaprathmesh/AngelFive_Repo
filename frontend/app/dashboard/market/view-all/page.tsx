import React from "react";

type Section = "most-bought" | "top-movers" | "top-performers" | "technical-screeners" | "pocket-friendly";

interface QuoteLike {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
}

export default async function ViewAllPage({ searchParams }: { searchParams: Promise<{ section?: Section }> }) {
  const sp = await searchParams;
  const section = (sp?.section || "most-bought") as Section;
  const resp = await fetch(`http://localhost:5000/api/market/discovery`, { cache: "no-store" });
  const data = resp.ok ? await resp.json() : {};
  let items: QuoteLike[] = [];
  if (section === "most-bought") items = data.mostBought || [];
  else if (section === "top-movers") items = [...(data.topGainers || []), ...(data.topLosers || [])];
  else if (section === "pocket-friendly") items = [...(data.pocketFriendly?.under50 || []), ...(data.pocketFriendly?.under100 || []), ...(data.pocketFriendly?.under200 || [])];

  return (
    <div className="w-full p-4">
      <h2 className="text-base font-semibold mb-4">View All — {section.replace('-', ' ')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((q, i) => (
          <div key={i} className="border rounded-lg p-3">
            <div className="text-sm font-semibold">{q.symbol}</div>
            <div className="text-xs">₹{Number(q.regularMarketPrice || 0).toFixed(2)}</div>
            <div className="text-xs">{Number(q.regularMarketChangePercent || 0).toFixed(2)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
