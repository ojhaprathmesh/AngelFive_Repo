"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";
import { marketDataService } from "@/lib/market-data";

interface IndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
}

export function MarketOverview() {
  const [selectedIndex, setSelectedIndex] = useState<string>("SENSEX");
  const [indexData, setIndexData] = useState<IndexData[]>([
    {
      symbol: "SENSEX",
      name: "SENSEX",
      value: 84090.45,
      change: -151.74,
      changePercent: -0.18,
      isPositive: false,
    },
    {
      symbol: "NIFTY",
      name: "NIFTY",
      value: 25789.1,
      change: -67.0,
      changePercent: -0.26,
      isPositive: false,
    },
    {
      symbol: "BANKNIFTY",
      name: "BANKNIFTY",
      value: 58208.9,
      change: 432.55,
      changePercent: 0.75,
      isPositive: true,
    },
    {
      symbol: "INDIA VIX",
      name: "INDIA VIX",
      value: 12.67,
      change: 0.52,
      changePercent: 4.28,
      isPositive: true,
    },
    {
      symbol: "FINNIFTY",
      name: "FINNIFTY",
      value: 27352.3,
      change: 219.45,
      changePercent: 0.79,
      isPositive: true,
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  // Fetch real market data
  useEffect(() => {
    const fetchMarketData = async () => {
      setIsLoading(true);
      try {
        const [sensexData, niftyData] = await Promise.all([
          marketDataService.getSensexData(),
          marketDataService.getNiftyData(),
        ]);

        if (sensexData && niftyData) {
          setIndexData((prev) =>
            prev.map((index) => {
              if (index.symbol === "SENSEX") {
                return {
                  ...index,
                  value: sensexData.price || index.value,
                  change: sensexData.change || index.change,
                  changePercent:
                    sensexData.changePercent || index.changePercent,
                  isPositive: (sensexData.change || index.change) >= 0,
                };
              }
              if (index.symbol === "NIFTY") {
                return {
                  ...index,
                  value: niftyData.price || index.value,
                  change: niftyData.change || index.change,
                  changePercent: niftyData.changePercent || index.changePercent,
                  isPositive: (niftyData.change || index.change) >= 0,
                };
              }
              return index;
            }),
          );
        }
      } catch (error) {
        console.error("Error fetching market data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Index Overview
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 border-blue-600 hover:bg-blue-50"
        >
          VIEW ALL →
        </Button>
      </div>

      {/* Index Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {indexData.map((index) => (
          <Card
            key={index.symbol}
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedIndex === index.symbol
                ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950"
                : "hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
            onClick={() => setSelectedIndex(index.symbol)}
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                {/* Index Name */}
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {index.name}
                </div>

                {/* Current Value */}
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {index.value.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>

                {/* Change and Percentage */}
                <div className="flex items-center space-x-1">
                  {index.isPositive ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      index.isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {index.isPositive ? "+" : ""}
                    {index.change.toFixed(2)}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      index.isPositive
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }`}
                  >
                    {index.isPositive ? "+" : ""}
                    {index.changePercent.toFixed(2)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
