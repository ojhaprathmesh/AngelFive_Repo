"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Performer {
  symbol: string;
  price: number;
  changePercent: number;
}

const ranges = ["1W", "1M", "1Y", "5Y"] as const;
type Range = typeof ranges[number];

export function TopPerformers() {
  const [range, setRange] = useState<Range>("1W");
  const [items, setItems] = useState<Performer[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/market/top-performers?range=${range}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        const api: Array<{ symbol: string; price: number; changePercent: number }> = data.data || [];
        const list: Performer[] = api
          .slice(0, 4)
          .map((d) => ({ symbol: d.symbol, price: d.price, changePercent: d.changePercent }));
        setItems(list);
      } catch {
        setItems([]);
      }
    };
    load();
  }, [range]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Top Performers</h2>
        <a href="#" className="text-sm text-blue-600">VIEW ALL →</a>
      </div>
      <div className="flex gap-2">
        {ranges.map((r) => (
          <Button key={r} variant={range === r ? "default" : "ghost"} size="sm" onClick={() => setRange(r)}>{r}</Button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((p) => (
          <Card key={p.symbol} className="hover:shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.symbol}</div>
              <div className="text-lg font-bold">
                {p.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <Badge className={`text-xs ${p.changePercent >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.changePercent >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}