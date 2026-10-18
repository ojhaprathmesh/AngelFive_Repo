"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { pollJobResult } from "../utils/polling";

function CorrelationHeatmapTable({ data }: { data: any }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data?.correlationMatrix || !data?.symbols) return;

    container.innerHTML = "";

    const matrix = data.correlationMatrix;
    const symbols = data.symbols;

    // Create a modern HTML table heatmap
    const table = document.createElement("table");
    table.className = "w-full border-collapse text-xs";
    table.style.fontSize = "11px";

    // Header row
    const headerRow = document.createElement("tr");
    const emptyCell = document.createElement("th");
    emptyCell.className =
      "p-2 bg-gray-100 dark:bg-gray-800 sticky top-0 left-0 z-20";
    headerRow.appendChild(emptyCell);

    symbols.forEach((sym: string) => {
      const th = document.createElement("th");
      th.className =
        "p-2 bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 border-b-2 border-gray-300 dark:border-gray-600";
      const symText = sym.replace("-EQ", "").substring(0, 8);
      th.innerHTML = `<div class="transform -rotate-45 origin-center whitespace-nowrap font-bold text-gray-700 dark:text-gray-300" style="height: 60px; display: flex; align-items: flex-end; justify-content: flex-start;">${symText}</div>`;
      th.style.minWidth = "40px";
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Data rows
    matrix.forEach((row: number[], i: number) => {
      const tr = document.createElement("tr");
      tr.className =
        "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors";

      const labelCell = document.createElement("td");
      labelCell.className =
        "p-2 font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 sticky left-0 z-10 border-r-2 border-gray-300 dark:border-gray-600";
      labelCell.textContent = symbols[i].replace("-EQ", "").substring(0, 8);
      labelCell.style.minWidth = "80px";
      tr.appendChild(labelCell);

      row.forEach((val: number | null | undefined, j: number) => {
        const td = document.createElement("td");
        td.className =
          "p-2 text-center font-semibold border border-gray-200 dark:border-gray-700 transition-all hover:scale-110 hover:z-30 hover:shadow-lg cursor-pointer";

        // Handle null/undefined values
        if (val === null || val === undefined || isNaN(val)) {
          td.textContent = "N/A";
          td.style.backgroundColor = "rgb(243, 244, 246)";
          td.style.color = "rgb(156, 163, 175)";
          td.title = `${symbols[i]} vs ${symbols[j]}: No data`;
          tr.appendChild(td);
          return;
        }

        const intensity = Math.abs(val);
        let color: string;

        if (i === j) {
          // Diagonal - neutral gray
          color = "rgb(229, 231, 235)";
          td.style.color = "rgb(55, 65, 81)";
        } else if (val >= 0) {
          // Positive correlation - green gradient
          const greenIntensity = Math.pow(intensity, 0.7); // Non-linear for better visibility
          color = `rgba(34, 197, 94, ${greenIntensity})`;
          td.style.color = greenIntensity > 0.5 ? "white" : "rgb(22, 101, 52)";
        } else {
          // Negative correlation - red gradient
          const redIntensity = Math.pow(intensity, 0.7);
          color = `rgba(239, 68, 68, ${redIntensity})`;
          td.style.color = redIntensity > 0.5 ? "white" : "rgb(127, 29, 29)";
        }

        td.style.backgroundColor = color;
        td.textContent = val.toFixed(2);
        td.title = `${symbols[i]} vs ${symbols[j]}: ${val.toFixed(3)}`;

        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    container.appendChild(table);

    return () => {
      if (container) container.innerHTML = "";
    };
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}

export function CorrelationAnalysis() {
  const [loading, setLoading] = useState(false);
  const [correlationData, setCorrelationData] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<string>("3M");
  const [error, setError] = useState<string | null>(null);

  const fetchCorrelationData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/dsfm/correlation?timeframe=${timeframe}`);
      if (resp.ok) {
        const { jobId, queueName } = await resp.json();
        const data = await pollJobResult<any>(queueName, jobId);
        setCorrelationData(data);
      } else {
        const errorData = await resp
          .json()
          .catch(() => ({ error: `HTTP ${resp.status}` }));
        setError(
          errorData.error ||
            errorData.message ||
            "Failed to fetch correlation data",
        );
      }
    } catch (e: unknown) {
      setError((e as Error).message || "Network error occurred");
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    void fetchCorrelationData();
  }, [fetchCorrelationData]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Correlation Analysis</CardTitle>
          <CardDescription>
            Analyze correlation matrix and relationships between NIFTY 50 stocks
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Timeframe:</span>
                <Select
                  value={timeframe}
                  onValueChange={(value) => setTimeframe(value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1M">1 Month</SelectItem>
                    <SelectItem value="3M">3 Months</SelectItem>
                    <SelectItem value="6M">6 Months</SelectItem>
                    <SelectItem value="1Y">1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => void fetchCorrelationData()}
                disabled={loading}
              >
                {loading ? "Analyzing..." : "Analyze Correlations"}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Analyzing all 50 NIFTY 50 stocks
          </p>

          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : error ? (
            <div className="rounded-lg bg-red-50 py-8 text-center font-semibold text-red-500 dark:bg-red-900/20">
              {error}
            </div>
          ) : correlationData ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Correlation Matrix Heatmap</CardTitle>
                  <CardDescription>
                    Pairwise correlations between stock returns. Green =
                    positive, Red = negative correlation.
                  </CardDescription>
                  <CardAction>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Color Scale:
                      </span>
                      <div className="flex items-center gap-1">
                        <div
                          className="h-6 w-12 rounded"
                          style={{
                            background:
                              "linear-gradient(to right, rgba(239,68,68,1), rgba(239,68,68,0))",
                          }}
                        />
                        <span className="text-xs text-gray-500">0</span>
                        <div
                          className="h-6 w-12 rounded"
                          style={{
                            background:
                              "linear-gradient(to right, rgba(34,197,94,0), rgba(34,197,94,1))",
                          }}
                        />
                      </div>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="max-h-150 overflow-auto rounded-lg border-2 border-gray-200 dark:border-gray-700">
                    <CorrelationHeatmapTable data={correlationData} />
                  </div>
                  {correlationData?.averageCorrelation && (
                    <div className="mt-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Average Correlation:
                        </span>
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {correlationData.averageCorrelation.toFixed(3)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        {correlationData.averageCorrelation > 0.5
                          ? "High correlation - stocks move together"
                          : correlationData.averageCorrelation > 0.3
                            ? "Moderate correlation - some co-movement"
                            : "Low correlation - diversified movements"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              Click "Analyze Correlations" to load correlation matrix
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
