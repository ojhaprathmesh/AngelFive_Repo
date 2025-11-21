"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineStyle,
  ColorType,
  AreaSeries,
  CandlestickSeries,
  Time,
  UTCTimestamp,
  BusinessDay,
} from "lightweight-charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { marketDataService, type MarketData as LiveMarketData } from "@/lib/market-data";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  BarChart3,
  Activity,
} from "lucide-react";

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  lastUpdated?: string;
}

interface ChartData {
  time: Time;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

type TimeFrame = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y" | "Max";
type ChartType = "Area" | "Candles";
type IndexType = "SENSEX" | "NIFTY" | "BANKNIFTY" | "INDIAVIX" | "FINNIFTY";

interface IndexData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  dayRange: { low: number; high: number };
}

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area" | "Candlestick"> | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<IndexType>("SENSEX");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1D");
  const [chartType, setChartType] = useState<ChartType>("Area");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [indexState, setIndexState] = useState<Record<IndexType, LiveMarketData | null>>({
    SENSEX: null,
    NIFTY: null,
    BANKNIFTY: null,
    INDIAVIX: null,
    FINNIFTY: null
  });

  // Persist chart type selection across sessions
  useEffect(() => {
    try {
      const saved = localStorage.getItem("chartType");
      if (saved === "Area" || saved === "Candles") {
        setChartType(saved as ChartType);
      }
    } catch (e) {
      // ignore access errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("chartType", chartType);
    } catch (e) {
      // ignore access errors
    }
  }, [chartType]);

  // Toggle chart type handler
  const toggleChartType = useCallback(() => {
    setChartType((prev) => (prev === "Area" ? "Candles" : "Area"));
  }, []);

  const currentData = indexState[selectedIndex]
    ? {
        symbol: selectedIndex,
        price: indexState[selectedIndex]!.price,
        change: indexState[selectedIndex]!.change,
        changePercent: indexState[selectedIndex]!.changePercent,
        open: indexState[selectedIndex]!.open || 0,
        high: indexState[selectedIndex]!.high || 0,
        low: indexState[selectedIndex]!.low || 0,
        close: indexState[selectedIndex]!.close || 0,
        dayRange: {
          low: indexState[selectedIndex]!.low || 0,
          high: indexState[selectedIndex]!.high || 0,
        },
      }
    : {
        symbol: selectedIndex,
        price: 0,
        change: 0,
        changePercent: 0,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        dayRange: { low: 0, high: 0 },
      };
  const isPositive = currentData.change >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  // Initialize chart
  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#374151",
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: "transparent" },
        horzLines: { color: "#e5e7eb" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: "#758696",
          style: LineStyle.Dashed,
        },
        horzLine: {
          width: 1,
          color: "#758696",
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: "#e5e7eb",
        visible: true,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
      // Disable zoom and pan interactions
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;

    // Remove TradingView attribution logo and its style tag from the chart container
    const removeBranding = () => {
      const containerNode = chartContainerRef.current;
      if (!containerNode) return;
      // Remove anchor with id tv-attr-logo (and its SVG children)
      const logoAnchor = containerNode.querySelector("a#tv-attr-logo");
      if (logoAnchor) {
        logoAnchor.remove();
      }
      // Remove any inline style tags that reference the tv-attr-logo selector
      const styleTags = containerNode.querySelectorAll("style");
      styleTags.forEach((styleEl) => {
        if (
          styleEl.textContent &&
          styleEl.textContent.includes("tv-attr-logo")
        ) {
          styleEl.remove();
        }
      });
    };
    // Attempt removal immediately and shortly after render to catch async insertion
    removeBranding();
    setTimeout(removeBranding, 0);
    setTimeout(removeBranding, 250);

    // Add series based on chart type
    if (chartType === "Area") {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: isPositive ? "#22c55e" : "#ef4444",
        topColor: isPositive
          ? "rgba(34, 197, 94, 0.3)"
          : "rgba(239, 68, 68, 0.3)",
        bottomColor: isPositive
          ? "rgba(34, 197, 94, 0.05)"
          : "rgba(239, 68, 68, 0.05)",
        lineWidth: 2,
      });
      seriesRef.current = areaSeries;
    } else {
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      seriesRef.current = candlestickSeries;
    }

    // Generate sample data for the current timeframe
    const sampleData = generateSampleData(timeFrame);
    setChartData(sampleData);

    if (seriesRef.current) {
      const chartDataForSeries = sampleData.map((d) => ({
        time: d.time,
        ...(chartType === "Area"
          ? { value: d.value }
          : {
              open: d.open || d.value,
              high: d.high || d.value * 1.02,
              low: d.low || d.value * 0.98,
              close: d.close || d.value,
            }),
      }));

      seriesRef.current.setData(chartDataForSeries);

      // Fit the chart to show all data automatically
      chart.timeScale().fitContent();
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [chartType, selectedIndex, isPositive, timeFrame]);

  const generateSampleData = (timeframe: TimeFrame = timeFrame) => {
    const data: ChartData[] = [];
    const basePrice = currentData.price;
    const now = new Date();

    // Calculate the number of data points and time interval based on timeframe
    let dataPoints: number;
    let intervalMs: number;

    switch (timeframe) {
      case "1D":
        dataPoints = 24; // 24 hours
        intervalMs = 60 * 60 * 1000; // 1 hour intervals
        break;
      case "5D":
        dataPoints = 5; // 5 days
        intervalMs = 24 * 60 * 60 * 1000; // 1 day intervals
        break;
      case "1M":
        dataPoints = 30; // 30 days
        intervalMs = 24 * 60 * 60 * 1000; // 1 day intervals
        break;
      case "6M":
        dataPoints = 26; // 26 weeks
        intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week intervals
        break;
      case "1Y":
        dataPoints = 52; // 52 weeks
        intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week intervals
        break;
      case "5Y":
        dataPoints = 60; // 60 months
        intervalMs = 30 * 24 * 60 * 60 * 1000; // 1 month intervals
        break;
      case "Max":
        dataPoints = 120; // 10 years worth of months
        intervalMs = 30 * 24 * 60 * 60 * 1000; // 1 month intervals
        break;
      default:
        dataPoints = 100;
        intervalMs = 24 * 60 * 60 * 1000;
    }

    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * intervalMs);
      const randomFactor = 0.95 + Math.random() * 0.1;
      const value = basePrice * randomFactor;

      // Format time based on timeframe - lightweight-charts expects specific formats
      let timeValue: Time;
      if (timeframe === "1D") {
        // For intraday data, use Unix timestamp (UTCTimestamp)
        timeValue = Math.floor(time.getTime() / 1000) as UTCTimestamp;
      } else {
        // For daily and longer timeframes, use BusinessDay
        timeValue = {
          year: time.getUTCFullYear(),
          month: (time.getUTCMonth() + 1) as number,
          day: time.getUTCDate(),
        } as BusinessDay;
      }

      data.push({
        time: timeValue,
        value,
        open: value * (0.99 + Math.random() * 0.02),
        high: value * (1.01 + Math.random() * 0.02),
        low: value * (0.97 + Math.random() * 0.02),
        close: value,
      });
    }

    return data;
  };

  // Initialize chart on mount and when dependencies change
  useEffect(() => {
    const cleanup = initializeChart();
    setIsLoading(false);
    return cleanup;
  }, [initializeChart]);

  useEffect(() => {
    const map: Record<IndexType, string> = {
      SENSEX: "BSE:SENSEX",
      NIFTY: "NSE:NIFTY",
      BANKNIFTY: "NSE:BANKNIFTY",
      INDIAVIX: "NSE:INDIAVIX",
      FINNIFTY: "NSE:FINNIFTY",
    };
    const load = async () => {
      try {
        const keys: IndexType[] = ["SENSEX","NIFTY","BANKNIFTY","INDIAVIX","FINNIFTY"];
        const updates: Record<IndexType, LiveMarketData | null> = { SENSEX:null,NIFTY:null,BANKNIFTY:null,INDIAVIX:null,FINNIFTY:null };
        for (const k of keys) {
          const r = await marketDataService.getMarketDataWithStatus(map[k]);
          updates[k] = r.data;
        }
        setIndexState(updates);
      } catch (err) {
        setError("Failed to fetch market data");
      }
    };
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const map: Record<IndexType, string> = {
      SENSEX: "BSE:SENSEX",
      NIFTY: "NSE:NIFTY",
      BANKNIFTY: "NSE:BANKNIFTY",
      INDIAVIX: "NSE:INDIAVIX",
      FINNIFTY: "NSE:FINNIFTY",
    };``
    const run = async () => {
      try {
        const symbol = map[selectedIndex];
        const now = new Date();
        const toDate = `${format(now, "yyyy-MM-dd HH:mm")}`;
        const from = new Date(now);
        let interval = "ONE_DAY";
        switch (timeFrame) {
          case "1D":
            interval = "ONE_MINUTE";
            from.setHours(now.getHours() - 8);
            break;
          case "5D":
            interval = "THREE_MINUTE";
            from.setDate(now.getDate() - 5);
            break;
          case "1M":
            interval = "FIFTEEN_MINUTE";
            from.setMonth(now.getMonth() - 1);
            break;
          case "6M":
            interval = "ONE_DAY";
            from.setMonth(now.getMonth() - 6);
            break;
          case "1Y":
            interval = "ONE_DAY";
            from.setFullYear(now.getFullYear() - 1);
            break;
          case "5Y":
            interval = "ONE_DAY";
            from.setFullYear(now.getFullYear() - 5);
            break;
          case "Max":
            interval = "ONE_DAY";
            from.setFullYear(now.getFullYear() - 10);
            break;
        }
        const fromDate = `${format(from, "yyyy-MM-dd HH:mm")}`;
        const tokenInfo = await marketDataService.getSymbolToken(symbol);
        if (!tokenInfo) return;
        const candles = await marketDataService.getCandleData(tokenInfo.exchange, tokenInfo.token, interval, fromDate, toDate);
        const mapped = candles.map((c) => ({
          time: Math.floor(new Date(c[0]).getTime() / 1000) as UTCTimestamp,
          value: c[4],
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
        }));
        setChartData(mapped);
        if (seriesRef.current) {
          if (chartType === "Area") {
            seriesRef.current.setData(mapped.map((d) => ({ time: d.time, value: d.value })));
          } else {
            seriesRef.current.setData(mapped.map((d) => ({ time: d.time, open: d.open!, high: d.high!, low: d.low!, close: d.close! })));
          }
          chartRef.current?.timeScale().fitContent();
        }
      } catch {}
    };
    run();
  }, [selectedIndex, timeFrame, chartType]);

  const timeFrames: TimeFrame[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "Max"];
  const indices: IndexType[] = ["SENSEX", "NIFTY", "BANKNIFTY", "INDIAVIX", "FINNIFTY"];

  if (error) {
    return (
      <Alert className="mx-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 w-full p-4 bg-white dark:bg-gray-800 rounded-sm shadow-[2px] border">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Index Overview
        </h2>
      </div>

      {/* Index tabs with solid vertical dividers and active bottom line */}
      <div className="border border-solid border-[var(--divider-color)] rounded-lg">
        <div className="flex flex-wrap items-center overflow-x-auto ">
          {indices.map((index, i) => {
            const data = indexState[index]
              ? {
                  symbol: index,
                  price: indexState[index]!.price,
                  change: indexState[index]!.change,
                  changePercent: indexState[index]!.changePercent,
                  open: indexState[index]!.open || 0,
                  high: indexState[index]!.high || 0,
                  low: indexState[index]!.low || 0,
                  close: indexState[index]!.close || 0,
                  dayRange: { low: indexState[index]!.low || 0, high: indexState[index]!.high || 0 },
                }
              : currentData;
            const isActive = selectedIndex === index;
            const isPositiveChange = data.change >= 0;

            return (
              <React.Fragment key={index}>
                <button
                  onClick={() => setSelectedIndex(index)}
                  className={`group px-3 py-2 transition-colors min-w-[120px] hover:bg-gray-50 dark:hover:bg-gray-700 border-b-2 ${
                    isActive ? "border-b-blue-500" : "border-b-transparent"
                  } ${index === "SENSEX" && isActive ? "rounded-tl-lg" : ""}`}
                >
                  <div className="text-[11px] font-medium text-gray-600 dark:text-gray-400 text-left truncate max-w-[100px]">
                    {index}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-[11px] font-medium text-gray-900 dark:text-white">
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
                {i <= indices.length - 1 && (
                  <div className="hidden lg:block v-divider-air v-divider-air-tabs self-center mx-2" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="divider-line" />

        {/* Main Container - Flexbox Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Section - OHLC Chart Component and Heatscale Visualization */}
          <div
            className="flex-1 lg:flex-[1] space-y-6 min-w-[300px]"
            role="complementary"
            aria-label="Market Data and Analysis Section"
          >
            {/* Heatscale Visualization */}
            <div
              className="bg-white dark:bg-gray-900 p-3"
              style={{ zIndex: 1 }}
            >
              <h3 className="text-[12px] font-medium text-gray-900 dark:text-white mb-3">
                Day&apos;s High/Low
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <div className="w-full h-1.5 bg-gradient-to-r from-[#d64d4d] to-[#029076] rounded-full"></div>
                  <div
                    className="absolute -top-2 transition-all duration-300"
                    style={{
                      left: `${Math.max(
                        0,
                        Math.min(
                          100,
                          ((currentData.price - currentData.dayRange.low) /
                            (currentData.dayRange.high -
                              currentData.dayRange.low)) *
                            100
                        )
                      )}%`,
                      transform:
                        "translateX(-50%) translateY(-40%) rotate(180deg)",
                    }}
                    aria-label={`Current price position: ${(
                      ((currentData.price - currentData.dayRange.low) /
                        (currentData.dayRange.high -
                          currentData.dayRange.low)) *
                      100
                    ).toFixed(1)}% of day's range`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      className="text-gray-800 dark:text-white"
                      fill="currentColor"
                    >
                      <path d="M8 2l4 6H4l4-6z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px] font-medium">
                  <div className="flex flex-col">
                    <span>
                      {currentData.dayRange.low.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[12px] text-gray-600 dark:text-gray-400">
                      Low
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span>
                      {currentData.dayRange.high.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[12px] text-gray-600 dark:text-gray-400">
                      High
                    </span>
                  </div>
                </div>
                {/* OHLC values directly below heatscale */}
                <div className="grid grid-cols-4 gap-0 divide-x divide-custom divide-dotted text-[12px] font-medium">
                  <div className="flex flex-col pr-3">
                    <div className="text-gray-600 dark:text-gray-400 mb-1">
                      Open
                    </div>
                    <div className="font-numbers numeric-tabular text-gray-900 dark:text-white font-bold">
                      {currentData.open.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col px-3">
                    <div className="text-gray-600 dark:text-gray-400 mb-1">
                      High
                    </div>
                    <div className="font-numbers numeric-tabular text-green-600 dark:text-green-400 font-bold">
                      {currentData.high.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col px-3">
                    <div className="text-gray-600 dark:text-gray-400 mb-1">
                      Low
                    </div>
                    <div className="font-numbers numeric-tabular text-red-600 dark:text-red-400 font-bold">
                      {currentData.low.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col pl-3">
                    <div className="text-gray-600 dark:text-gray-400 mb-1">
                      Close
                    </div>
                    <div className="font-numbers numeric-tabular text-gray-900 dark:text-white font-bold">
                      {currentData.close.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dotted vertical separation between heatscale and chart */}
          <div className="hidden lg:block v-divider-air v-divider-air-chart self-center mx-2" />

          {/* Right Section */}
          {/* Primary Chart Container */}
            <div
              className="flex-1 lg:flex-[1] relative bg-white dark:bg-gray-900 rounded-lg"
              style={{ zIndex: 1 }}
            >
              {isLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-lg"
                  style={{ zIndex: 10 }}
                >
                  <Skeleton className="w-full h-[280px]" />
                </div>
              )}
              <div
                ref={chartContainerRef}
                className="w-full h-[280px] rounded-lg"
                role="img"
                aria-label={`${selectedIndex} price chart showing ${chartType.toLowerCase()} visualization for ${timeFrame} timeframe`}
              />

              <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-1.5 flex-wrap" aria-label="Select chart timeframe">
                  {timeFrames.map((tf) => (
                    <Button
                      key={tf}
                      variant={timeFrame === tf ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTimeFrame(tf)}
                      className="text-xs px-3 py-1 rounded-full"
                      aria-label={`Select ${tf} time frame`}
                    >
                      {tf}
                    </Button>
                  ))}
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleChartType}
                    aria-label={
                      chartType === "Area"
                        ? "Area chart selected. Click to switch to Candlestick chart"
                        : "Candlestick chart selected. Click to switch to Area chart"
                    }
                    aria-pressed={chartType === "Candles"}
                    className="rounded-lg px-2"
                    title={
                      chartType === "Area"
                        ? "Switch to Candles"
                        : "Switch to Area"
                    }
                  >
                    {chartType === "Area" ? (
                      <Activity className="h-5 w-5" />
                    ) : (
                      <BarChart3 className="h-5 w-5" />
                    )}
                    <span className="sr-only">
                      {chartType === "Area" ? "Area chart selected" : "Candlestick chart selected"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
