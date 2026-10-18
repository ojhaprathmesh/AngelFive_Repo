"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReturnsData } from "@/features/dsfm/types";

interface ChartsTabProps {
  data?: ReturnsData | null;
  prices?: number[];
  logReturns?: number[];
  timestamps?: string[];
  priceChartRef?: React.RefObject<HTMLDivElement | null>;
  returnsChartRef?: React.RefObject<HTMLDivElement | null>;
}

export function ChartsTab({
  data,
  prices: propsPrices,
  logReturns: propsLogReturns,
  timestamps: propsTimestamps,
  priceChartRef,
  returnsChartRef,
}: ChartsTabProps) {
  const internalPriceRef = useRef<HTMLDivElement>(null);
  const internalReturnsRef = useRef<HTMLDivElement>(null);

  const activePriceRef = priceChartRef ?? internalPriceRef;
  const activeReturnsRef = returnsChartRef ?? internalReturnsRef;

  const prices = useMemo(
    () => propsPrices ?? data?.prices ?? [],
    [propsPrices, data?.prices],
  );
  const logReturns = useMemo(
    () => propsLogReturns ?? data?.logReturns ?? [],
    [propsLogReturns, data?.logReturns],
  );
  const timestamps = useMemo(
    () => propsTimestamps ?? data?.timestamps,
    [propsTimestamps, data?.timestamps],
  );

  // Render Stock Price Chart
  useEffect(() => {
    const container = activePriceRef.current;
    if (!container || prices.length === 0) return;

    let chartInstance: import("lightweight-charts").IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let isCancelled = false;

    import("lightweight-charts").then(
      ({ createChart, AreaSeries, ColorType }) => {
        if (isCancelled || !container) return;
        container.innerHTML = "";

        const chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#374151",
          },
          width: container.clientWidth || 600,
          height: 300,
          grid: {
            vertLines: { color: "transparent" },
            horzLines: { color: "#e5e7eb" },
          },
        });
        chartInstance = chart;

        const series = chart.addSeries(AreaSeries, {
          lineColor: "#3b82f6",
          topColor: "rgba(59, 130, 246, 0.3)",
          bottomColor: "rgba(59, 130, 246, 0.05)",
          lineWidth: 2,
        });

        const useTimestamps =
          !!timestamps && timestamps.length === prices.length;
        if (!useTimestamps) {
          chart.applyOptions({
            timeScale: {
              tickMarkFormatter: (t: unknown) =>
                `${typeof t === "number" ? t : ""}`,
            },
          });
        }

        let lastTime = -Infinity;
        const chartData = prices.map((price, index) => {
          if (useTimestamps && timestamps && timestamps[index]) {
            const date = new Date(timestamps[index]);
            let timeVal = Math.floor(date.getTime() / 1000);
            if (isNaN(timeVal) || timeVal <= lastTime) {
              timeVal = (lastTime > 0 ? lastTime : 0) + 1;
            }
            lastTime = timeVal;
            return {
              time: timeVal as import("lightweight-charts").Time,
              value: price,
            };
          }
          return {
            time: index as import("lightweight-charts").Time,
            value: price,
          };
        });

        series.setData(chartData);
        chart.timeScale().fitContent();

        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.contentRect.width > 0 && chartInstance) {
              chartInstance.applyOptions({ width: entry.contentRect.width });
              chartInstance.timeScale().fitContent();
            }
          }
        });
        resizeObserver.observe(container);
      },
    );

    return () => {
      isCancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (chartInstance) chartInstance.remove();
      if (container) container.innerHTML = "";
    };
  }, [prices, timestamps, activePriceRef]);

  // Render Log Returns Chart
  useEffect(() => {
    const container = activeReturnsRef.current;
    if (!container || logReturns.length === 0) return;

    let chartInstance: import("lightweight-charts").IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let isCancelled = false;

    import("lightweight-charts").then(
      ({ createChart, AreaSeries, ColorType }) => {
        if (isCancelled || !container) return;
        container.innerHTML = "";

        const chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#374151",
          },
          width: container.clientWidth || 600,
          height: 300,
          grid: {
            vertLines: { color: "transparent" },
            horzLines: { color: "#e5e7eb" },
          },
        });
        chartInstance = chart;

        const series = chart.addSeries(AreaSeries, {
          lineColor: "#10b981",
          topColor: "rgba(16, 185, 129, 0.3)",
          bottomColor: "rgba(16, 185, 129, 0.05)",
          lineWidth: 2,
        });

        const useTimestamps =
          !!timestamps && timestamps.length >= logReturns.length + 1;
        if (!useTimestamps) {
          chart.applyOptions({
            timeScale: {
              tickMarkFormatter: (t: unknown) =>
                `${typeof t === "number" ? t : ""}`,
            },
          });
        }

        let lastTime = -Infinity;
        const chartData = logReturns.map((ret, index) => {
          if (useTimestamps && timestamps && timestamps[index + 1]) {
            const date = new Date(timestamps[index + 1]);
            let timeVal = Math.floor(date.getTime() / 1000);
            if (isNaN(timeVal) || timeVal <= lastTime) {
              timeVal = (lastTime > 0 ? lastTime : 0) + 1;
            }
            lastTime = timeVal;
            return {
              time: timeVal as import("lightweight-charts").Time,
              value: ret * 100,
            };
          }
          return {
            time: index as import("lightweight-charts").Time,
            value: ret * 100,
          };
        });

        series.setData(chartData);
        chart.timeScale().fitContent();

        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.contentRect.width > 0 && chartInstance) {
              chartInstance.applyOptions({ width: entry.contentRect.width });
              chartInstance.timeScale().fitContent();
            }
          }
        });
        resizeObserver.observe(container);
      },
    );

    return () => {
      isCancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (chartInstance) chartInstance.remove();
      if (container) container.innerHTML = "";
    };
  }, [logReturns, timestamps, activeReturnsRef]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Stock Price Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={activePriceRef} className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Log Returns Chart</CardTitle>
          <CardDescription>Daily log returns: ln(Pₜ / Pₜ₋₁)</CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={activeReturnsRef} className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
