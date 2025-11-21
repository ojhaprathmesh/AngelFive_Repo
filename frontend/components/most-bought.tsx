"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Item {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function MostBoughtStocks() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/market/most-bought`);
        const data = await res.json();
        const api: Array<{ symbol: string; price: number; change: number; changePercent: number }> = data.data || [];
        const list: Item[] = api
          .map((d) => ({ symbol: d.symbol, price: d.price, change: d.change, changePercent: d.changePercent }))
          .slice(0, 5);
        setItems(list);
      } catch {
        setItems([]);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Most Bought Stocks</h2>
        <a href="#" className="text-sm text-blue-600">VIEW ALL →</a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map((item) => {
          const positive = item.change >= 0;
          return (
            <Card key={item.symbol} className="hover:shadow-sm">
              <CardContent className="p-4 space-y-2">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.symbol}</div>
                <div className="text-lg font-bold">
                  {item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
                    {positive ? '+' : ''}{item.change.toFixed(2)}
                  </span>
                  <Badge className={`${positive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{positive ? '+' : ''}{item.changePercent.toFixed(2)}%</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}