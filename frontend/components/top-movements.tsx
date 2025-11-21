"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface Item { symbol: string; price: number; changePercent: number }

export function TopMovements() {
  const [gainers, setGainers] = useState<Item[]>([]);
  const [losers, setLosers] = useState<Item[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/market/top-movers`);
        const data = await res.json();
        setGainers((data.data?.gainers || []).slice(0, 5));
        setLosers((data.data?.losers || []).slice(0, 5));
      } catch {
        setGainers([]);
        setLosers([]);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Top Movements</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="font-semibold">Top Gainers</div>
            <div className="space-y-2">
              {gainers.map((g) => (
                <div key={g.symbol} className="flex items-center justify-between text-sm">
                  <span>{g.symbol}</span>
                  <span className="text-green-600">{g.changePercent >= 0 ? '+' : ''}{g.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="font-semibold">Top Losers</div>
            <div className="space-y-2">
              {losers.map((l) => (
                <div key={l.symbol} className="flex items-center justify-between text-sm">
                  <span>{l.symbol}</span>
                  <span className="text-red-600">{l.changePercent >= 0 ? '+' : ''}{l.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}