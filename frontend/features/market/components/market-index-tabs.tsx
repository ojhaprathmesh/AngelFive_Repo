import { TrendingDown, TrendingUp } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import type { MarketData as LiveMarketData } from "@/features/market/services/market-data";

import { IndexType } from "../hooks/useLiveIndexData";

export interface CurrentData {
  symbol: IndexType;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  dayRange: { low: number; high: number };
}

interface MarketIndexTabsProps {
  indices: IndexType[];
  indexState: Record<IndexType, LiveMarketData | null>;
  currentData: CurrentData;
  selectedIndex: IndexType;
  onSelectIndex: (index: IndexType) => void;
}

export const MarketIndexTabs: React.FC<MarketIndexTabsProps> = ({
  indices,
  indexState,
  currentData,
  selectedIndex,
  onSelectIndex,
}) => {
  return (
    <div className="rounded-lg border border-solid border-(--divider-color)">
      <div className="grid grid-cols-5">
        {indices.map((index, i) => {
          const rawData = indexState[index];
          const data = rawData
            ? {
                symbol: index,
                price: rawData.price,
                change: rawData.change,
                changePercent: rawData.changePercent,
                open: rawData.open || 0,
                high: rawData.high || 0,
                low: rawData.low || 0,
                close: rawData.close || 0,
                dayRange: {
                  low: rawData.low || 0,
                  high: rawData.high || 0,
                },
              }
            : currentData;

          const isActive = selectedIndex === index;
          const isPositiveChange = data.change >= 0;

          return (
            <React.Fragment key={index}>
              <button
                onClick={() => onSelectIndex(index)}
                className={`group w-full border-b-2 px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  isActive ? "border-b-blue-500" : "border-b-transparent"
                } ${i !== 0 ? "border-l border-l-gray-200 dark:border-l-gray-700" : ""} ${
                  i === 0 && isActive ? "rounded-tl-lg" : ""
                } ${i === indices.length - 1 && isActive ? "rounded-tr-lg" : ""}`}
              >
                <div className="max-w-25 truncate text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  {index}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {data.price.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="flex items-center gap-1">
                    {isPositiveChange ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        isPositiveChange ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {isPositiveChange ? "+" : ""}
                      {data.change.toFixed(2)}
                    </span>
                    <Badge
                      className={`text-[11px] ${
                        isPositiveChange
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {isPositiveChange ? "+" : ""}
                      {data.changePercent.toFixed(2)}%
                    </Badge>
                  </div>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
