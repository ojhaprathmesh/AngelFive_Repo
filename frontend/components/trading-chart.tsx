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
} from "lightweight-charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  marketDataService,
  type MarketData as LiveMarketData,
} from "@/lib/market-data";
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
  const [chartDataLoading, setChartDataLoading] = useState(true);
  const [chartDataEmpty, setChartDataEmpty] = useState(false);
  const [autoSwitchedFrom, setAutoSwitchedFrom] = useState<TimeFrame | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [indexState, setIndexState] = useState<
    Record<IndexType, LiveMarketData | null>
  >({
    SENSEX: null,
    NIFTY: null,
    BANKNIFTY: null,
    INDIAVIX: null,
    FINNIFTY: null,
  });
  const [chartColor, setChartColor] = useState<"green" | "red">("green");

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
        lineColor: "#9ca3af",
        topColor: "rgba(156, 163, 175, 0.3)",
        bottomColor: "rgba(156, 163, 175, 0.05)",
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

    // Chart starts empty - real data is loaded by the fetch effect
    setChartData([]);

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
  }, [chartType, selectedIndex, timeFrame]);

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
        const keys: IndexType[] = [
          "SENSEX",
          "NIFTY",
          "BANKNIFTY",
          "INDIAVIX",
          "FINNIFTY",
        ];
        const updates: Record<IndexType, LiveMarketData | null> = {
          SENSEX: null,
          NIFTY: null,
          BANKNIFTY: null,
          INDIAVIX: null,
          FINNIFTY: null,
        };
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

  // Clear auto-switch message when user changes index
  useEffect(() => {
    setAutoSwitchedFrom(null);
  }, [selectedIndex]);

  useEffect(() => {
    const map: Record<IndexType, string> = {
      SENSEX: "BSE:SENSEX",
      NIFTY: "NSE:NIFTY",
      BANKNIFTY: "NSE:BANKNIFTY",
      INDIAVIX: "NSE:INDIAVIX",
      FINNIFTY: "NSE:FINNIFTY",
    };
    setChartDataLoading(true);
    setChartDataEmpty(false);

    const run = async () => {
      try {
        const symbol = map[selectedIndex];
        const now = new Date();

        // Helper: format a Date to "yyyy-MM-dd HH:mm" treating it as UTC values
        const fmtUTC = (d: Date) =>
          `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

        let fromDate: string;
        let toDate: string;
        let interval: string;

        if (timeFrame === "1D") {
          interval = "ONE_MINUTE";

          // AngelOne expects IST times. Compute "now" in IST (UTC+5:30).
          const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
          const nowIST = new Date(now.getTime() + IST_OFFSET_MS);

          const dow = nowIST.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat in IST
          const istH = nowIST.getUTCHours();
          const istM = nowIST.getUTCMinutes();
          const beforeOpen = istH < 9 || (istH === 9 && istM < 15);

          // How many days back to the last trading day?
          let daysBack = 0;
          if (dow === 0)
            daysBack = 2; // Sunday  → Friday
          else if (dow === 6)
            daysBack = 1; // Saturday → Friday
          else if (beforeOpen && dow === 1)
            daysBack = 3; // Monday before 9:15 → Friday
          else if (beforeOpen) daysBack = 1; // Weekday before 9:15 → yesterday

          const tDay = new Date(nowIST);
          tDay.setUTCDate(tDay.getUTCDate() - daysBack);

          // 09:15 IST = 03:45 UTC
          const fromUTC = new Date(
            Date.UTC(
              tDay.getUTCFullYear(),
              tDay.getUTCMonth(),
              tDay.getUTCDate(),
              3,
              45,
            ),
          );
          // 15:30 IST = 10:00 UTC
          const toUTC = new Date(
            Date.UTC(
              tDay.getUTCFullYear(),
              tDay.getUTCMonth(),
              tDay.getUTCDate(),
              10,
              0,
            ),
          );

          fromDate = fmtUTC(fromUTC);
          toDate = fmtUTC(toUTC);
        } else {
          const from = new Date(now);
          toDate = format(now, "yyyy-MM-dd HH:mm");
          switch (timeFrame) {
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
            default:
              interval = "ONE_DAY";
              from.setFullYear(now.getFullYear() - 1);
          }
          fromDate = format(from, "yyyy-MM-dd HH:mm");
        }

        const tokenInfo = await marketDataService.getSymbolToken(symbol);
        if (!tokenInfo) {
          setChartDataEmpty(true);
          return;
        }

        let candles = await marketDataService.getCandleData(
          tokenInfo.exchange,
          tokenInfo.token,
          interval,
          fromDate,
          toDate,
        );

        // 1D cascade fallback: ONE_MINUTE → FIVE_MINUTE → FIFTEEN_MINUTE
        if (timeFrame === "1D" && candles.length === 0) {
          candles = await marketDataService.getCandleData(
            tokenInfo.exchange,
            tokenInfo.token,
            "FIVE_MINUTE",
            fromDate,
            toDate,
          );
        }
        if (timeFrame === "1D" && candles.length === 0) {
          candles = await marketDataService.getCandleData(
            tokenInfo.exchange,
            tokenInfo.token,
            "FIFTEEN_MINUTE",
            fromDate,
            toDate,
          );
        }

        const mapped = candles.map((c) => ({
          time: Math.floor(new Date(c[0]).getTime() / 1000) as UTCTimestamp,
          value: c[4],
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
        }));

        // Determine color from chart data: first open vs last close
        if (mapped.length > 0) {
          const firstOpen = mapped[0].open ?? mapped[0].value;
          const lastClose =
            mapped[mapped.length - 1].close ?? mapped[mapped.length - 1].value;
          setChartColor(lastClose >= firstOpen ? "green" : "red");

          // Update area series colors to reflect chart-period direction
          if (seriesRef.current && chartType === "Area") {
            const color = lastClose >= firstOpen ? "#22c55e" : "#ef4444";
            seriesRef.current.applyOptions({
              lineColor: color,
              topColor:
                lastClose >= firstOpen
                  ? "rgba(34, 197, 94, 0.3)"
                  : "rgba(239, 68, 68, 0.3)",
              bottomColor:
                lastClose >= firstOpen
                  ? "rgba(34, 197, 94, 0.05)"
                  : "rgba(239, 68, 68, 0.05)",
            });
          }
        }

        const minPointsFor1D = 10;
        const isSparse1D =
          timeFrame === "1D" &&
          mapped.length > 0 &&
          mapped.length < minPointsFor1D;

        if (mapped.length === 0 || isSparse1D) {
          setChartDataEmpty(true);
          const tfList: TimeFrame[] = [
            "1D",
            "5D",
            "1M",
            "6M",
            "1Y",
            "5Y",
            "Max",
          ];
          const idx = tfList.indexOf(timeFrame);
          if (idx >= 0 && idx < tfList.length - 1) {
            setAutoSwitchedFrom(timeFrame);
            setTimeFrame(tfList[idx + 1]);
          }
        } else {
          setChartData(mapped);
          setChartDataEmpty(false);
          setAutoSwitchedFrom(null);
        }

        if (seriesRef.current && mapped.length > 0) {
          if (chartType === "Area") {
            seriesRef.current.setData(
              mapped.map((d) => ({ time: d.time, value: d.value })),
            );
          } else {
            seriesRef.current.setData(
              mapped.map((d) => ({
                time: d.time,
                open: d.open!,
                high: d.high!,
                low: d.low!,
                close: d.close!,
              })),
            );
          }
          chartRef.current?.timeScale().fitContent();
        }
      } catch {
        setChartDataEmpty(true);
      } finally {
        setChartDataLoading(false);
      }
    };
    run();
  }, [selectedIndex, timeFrame, chartType]);

  const timeFrames: TimeFrame[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "Max"];
  const indices: IndexType[] = [
    "SENSEX",
    "NIFTY",
    "BANKNIFTY",
    "INDIAVIX",
    "FINNIFTY",
  ];

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
      <div className="border border-solid border-(--divider-color) rounded-lg">
        <div className="grid grid-cols-5">
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
                  dayRange: {
                    low: indexState[index]!.low || 0,
                    high: indexState[index]!.high || 0,
                  },
                }
              : currentData;
            const isActive = selectedIndex === index;
            const isPositiveChange = data.change >= 0;

            return (
              <React.Fragment key={index}>
                <button
                  onClick={() => setSelectedIndex(index)}
                  className={`group w-full px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 border-b-2 ${
                    isActive ? "border-b-blue-500" : "border-b-transparent"
                  } ${i !== 0 ? "border-l border-l-gray-200 dark:border-l-gray-700" : ""} ${
                    i === 0 && isActive ? "rounded-tl-lg" : ""
                  } ${i === indices.length - 1 && isActive ? "rounded-tr-lg" : ""}`}
                >
                  <div className="text-[11px] font-medium text-gray-600 dark:text-gray-400 text-left truncate max-w-25">
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
              </React.Fragment>
            );
          })}
        </div>

        <div className="divider-line" />

        {/* Main Container - Flexbox Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Section - OHLC Chart Component and Heatscale Visualization */}
          <div
            className="flex-1 lg:flex-1 flex flex-col justify-center min-w-75"
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
                  <div className="w-full h-1.5 bg-linear-to-r from-[#d64d4d] to-[#029076] rounded-full"></div>
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
                            100,
                        ),
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
            className="flex-1 lg:flex-1 relative bg-white dark:bg-gray-900 rounded-lg"
            style={{ zIndex: 1 }}
          >
            {(isLoading || chartDataLoading) && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-lg z-10"
                style={{ zIndex: 10 }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Loading chart data...
                  </span>
                </div>
              </div>
            )}
            {autoSwitchedFrom && !chartDataEmpty && (
              <div
                className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs z-10"
                style={{ zIndex: 10 }}
              >
                {autoSwitchedFrom} unavailable for {selectedIndex}, showing{" "}
                {timeFrame}
              </div>
            )}
            {!chartDataLoading && chartDataEmpty && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-lg z-10"
                style={{ zIndex: 10 }}
              >
                <div className="flex flex-col items-center gap-2 text-center px-4">
                  <BarChart3 className="h-10 w-10 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    No chart data available for {timeFrame}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    Intraday data may not be available for indices. Try stocks
                    for 1D.
                  </span>
                </div>
              </div>
            )}
            <div
              ref={chartContainerRef}
              className="w-full h-70 rounded-lg"
              role="img"
              aria-label={`${selectedIndex} price chart showing ${chartType.toLowerCase()} visualization for ${timeFrame} timeframe`}
              style={{
                visibility:
                  isLoading || chartDataLoading ? "hidden" : "visible",
              }}
            />
            <div className="flex items-center justify-between p-2">
              <div
                className="flex items-center gap-1.5 flex-wrap"
                aria-label="Select chart timeframe"
              >
                {timeFrames.map((tf) => (
                  <Button
                    key={tf}
                    variant={timeFrame === tf ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setAutoSwitchedFrom(null);
                      setTimeFrame(tf);
                    }}
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
                    {chartType === "Area"
                      ? "Area chart selected"
                      : "Candlestick chart selected"}
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
