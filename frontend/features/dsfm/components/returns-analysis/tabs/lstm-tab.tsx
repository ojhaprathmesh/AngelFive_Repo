"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LSTMResult } from "@/features/dsfm/types";

interface LSTMTabProps {
  selectedSymbol: string;
  lstmResult: LSTMResult | null;
  loadingLSTM: boolean;
  lstmChartRef?: React.RefObject<HTMLDivElement | null>;
  runLstm: (symbol: string, lookback: number, steps: number) => Promise<void>;
}

function LstmForecastChart({
  forecast,
  externalRef,
}: {
  forecast: number[];
  externalRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalRef ?? internalRef;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !forecast || forecast.length === 0) return;

    let chartInstance: import("lightweight-charts").IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let isCancelled = false;

    import("lightweight-charts").then(
      ({ createChart, LineSeries, ColorType }) => {
        if (isCancelled || !container) return;
        container.innerHTML = "";

        const chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#374151",
          },
          width: container.clientWidth || 600,
          height: 240,
          grid: {
            vertLines: { color: "#e5e7eb" },
            horzLines: { color: "#e5e7eb" },
          },
        });
        chartInstance = chart;

        const baseTs = Math.floor(
          new Date("2000-01-01T00:00:00Z").getTime() / 1000,
        );

        chart.applyOptions({
          timeScale: {
            timeVisible: true,
            tickMarkFormatter: (t: unknown) => {
              const ts = typeof t === "number" ? t : 0;
              const idx = ts
                ? Math.max(0, Math.round((ts - baseTs) / 86400))
                : 0;
              return `Step ${idx}`;
            },
          },
          localization: { timeFormatter: () => "" },
        });

        const series = chart.addSeries(LineSeries, {
          color: "#8b5cf6",
          lineWidth: 2,
        });

        const chartData = forecast.map((v, i) => ({
          time: (baseTs + i * 86400) as import("lightweight-charts").Time,
          value: v,
        }));
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
  }, [forecast, containerRef]);

  return (
    <div ref={containerRef} className="mt-2 h-[240px] min-h-[240px] w-full" />
  );
}

export function LSTMTab({
  selectedSymbol,
  lstmResult,
  loadingLSTM,
  lstmChartRef,
  runLstm,
}: LSTMTabProps) {
  const handleRun = () => {
    const lookback = parseInt(
      (document.getElementById("lstm-lookback") as HTMLInputElement)?.value ||
        "10",
    );
    const steps = parseInt(
      (document.getElementById("lstm-steps") as HTMLInputElement)?.value || "5",
    );
    void runLstm(selectedSymbol, lookback, steps);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>LSTM (Long Short-Term Memory) Forecasting</CardTitle>
        <CardDescription>
          Deep learning model for time series forecasting using recurrent neural
          networks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="lstm-lookback"
              className="text-xs text-gray-600 dark:text-gray-400"
            >
              Lookback Period
            </label>
            <input
              id="lstm-lookback"
              type="number"
              min="5"
              max="60"
              defaultValue="10"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="lstm-steps"
              className="text-xs text-gray-600 dark:text-gray-400"
            >
              Forecast Steps
            </label>
            <input
              id="lstm-steps"
              type="number"
              min="1"
              max="30"
              defaultValue="5"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
        <Button onClick={handleRun} disabled={loadingLSTM}>
          {loadingLSTM ? "Training & Forecasting..." : "Run LSTM Model"}
        </Button>
        {lstmResult && (
          <div className="mt-4 space-y-2 rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
            <p className="font-semibold text-purple-800 dark:text-purple-200">
              LSTM Model Results
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">RMSE:</span>
                <span className="ml-2 font-mono font-bold">
                  {lstmResult.rmse?.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  R² Score:
                </span>
                <span className="ml-2 font-mono font-bold">
                  {lstmResult.r2_score?.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Training Loss:
                </span>
                <span className="ml-2 font-mono font-bold">
                  {lstmResult.training_loss?.toFixed(4)}
                </span>
              </div>
            </div>
            {lstmResult.forecast && (
              <div className="mt-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Forecast:
                </p>
                <p className="font-mono text-xs">
                  {lstmResult.forecast
                    .map((f: number) => f.toFixed(4))
                    .join(", ")}
                </p>
                <LstmForecastChart
                  forecast={lstmResult.forecast}
                  externalRef={lstmChartRef}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
