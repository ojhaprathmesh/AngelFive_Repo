"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
  Time,
  AreaSeries,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";

interface ReturnsData {
  symbol: string;
  meanReturn: number;
  volatility: number;
  sharpeRatio: number;
  skewness: number;
  kurtosis: number;
  minReturn: number;
  maxReturn: number;
  logReturns: number[];
  prices: number[];
  timestamps?: string[]; // Timestamps for chart x-axis
  calculations?: {
    meanReturn: { formula: string; description: string; value: number };
    volatility: { formula: string; description: string; value: number };
    sharpeRatio: { formula: string; description: string; value: number };
    range: {
      formula: string;
      description: string;
      value: { min: number; max: number };
    };
  };
}

interface ADFTestResult {
  testStatistic: number;
  pValue: number;
  criticalValues: { "1%": number; "5%": number; "10%": number };
  isStationary: boolean;
  interpretation: string;
  recommendation: string;
}

interface ACFPACFData {
  lags: number[];
  acf: number[];
  pacf: number[];
  confidenceInterval: number;
}

export function ReturnsAnalysis() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [returnsData, setReturnsData] = useState<ReturnsData | null>(null);
  const [adfResult, setAdfResult] = useState<ADFTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingADF, setLoadingADF] = useState(false);
  const [loadingARIMA, setLoadingARIMA] = useState(false);
  const [loadingGARCH, setLoadingGARCH] = useState(false);
  const [timeframe, setTimeframe] = useState<string>("1M");
  const [error, setError] = useState<string | null>(null);
  const [arimaResult, setArimaResult] = useState<any>(null);
  const [garchResult, setGarchResult] = useState<any>(null);
  const [lstmResult, setLstmResult] = useState<any>(null);
  const [loadingLSTM, setLoadingLSTM] = useState(false);
  const [finbertResult, setFinbertResult] = useState<any>(null);
  const [loadingFinBERT, setLoadingFinBERT] = useState(false);
  const [ruleSentimentResult, setRuleSentimentResult] = useState<any>(null);
  const [loadingRuleSentiment, setLoadingRuleSentiment] = useState(false);
  const [enhancedSharpe, setEnhancedSharpe] = useState<any>(null);
  const [loadingSharpe, setLoadingSharpe] = useState(false);
  const [sentimentText, setSentimentText] = useState<string>("");

  const priceChartRef = useRef<HTMLDivElement>(null);
  const returnsChartRef = useRef<HTMLDivElement>(null);
  const arimaChartRef = useRef<HTMLDivElement>(null);
  const garchVolChartRef = useRef<HTMLDivElement>(null);
  const lstmChartRef = useRef<HTMLDivElement>(null);
  const mptChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const popularStocks = [
      "RELIANCE",
      "TCS",
      "HDFCBANK",
      "INFY",
      "ICICIBANK",
      "HINDUNILVR",
      "SBIN",
      "BHARTIARTL",
      "ITC",
      "KOTAKBANK",
      "LT",
      "AXISBANK",
      "ASIANPAINT",
      "MARUTI",
      "TITAN",
      "ULTRACEMCO",
      "NESTLEIND",
      "BAJFINANCE",
      "WIPRO",
      "ONGC",
      "TATAMOTORS",
      "NTPC",
      "POWERGRID",
      "INDUSINDBK",
      "TECHM",
      "HCLTECH",
      "SUNPHARMA",
      "COALINDIA",
    ];
    setSymbols(popularStocks);
    if (!selectedSymbol) {
      setSelectedSymbol(popularStocks[0]);
    }
  }, []);

  useEffect(() => {
    if (selectedSymbol) {
      fetchReturnsData();
      fetchADFTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    if (arimaResult && Array.isArray(arimaResult.forecast)) {
      setTimeout(() => renderArimaChart(arimaResult.forecast), 100);
    }
  }, [arimaResult]);

  useEffect(() => {
    if (garchResult && Array.isArray(garchResult.conditionalVolatility)) {
      setTimeout(
        () =>
          renderGarchVolChart(
            garchResult.conditionalVolatility,
            garchResult.forecast,
          ),
        100,
      );
    }
  }, [garchResult]);

  useEffect(() => {
    if (lstmResult && Array.isArray(lstmResult.forecast)) {
      setTimeout(() => renderLstmChart(lstmResult.forecast), 100);
    }
  }, [lstmResult]);

  const fetchReturnsData = async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    setReturnsData(null);
    setError(null);
    try {
      const resp = await fetch(
        `/api/dsfm/returns?symbol=${selectedSymbol}&timeframe=${timeframe}`,
      );
      const contentType = resp.headers.get("content-type");

      if (resp.ok && contentType && contentType.includes("application/json")) {
        const data = await resp.json();
        setReturnsData(data);
        setError(null);
        // Render charts after data loads
        setTimeout(() => {
          renderPriceChart(data.prices, data.timestamps);
          renderReturnsChart(data.logReturns, data.timestamps);
        }, 100);
      } else {
        // Try to read error message from response
        let errorMessage = `Failed to fetch data (${resp.status} ${resp.statusText})`;
        try {
          // Clone the response to read it without consuming the original
          const responseClone = resp.clone();
          if (contentType && contentType.includes("application/json")) {
            const errorData = await responseClone.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const text = await responseClone.text();
            if (text) {
              // Try to parse as JSON if it looks like JSON
              try {
                const jsonData = JSON.parse(text);
                errorMessage =
                  jsonData.error || jsonData.message || errorMessage;
              } catch {
                errorMessage = text;
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }
        // Check if it's a SmartAPI credential error
        if (
          errorMessage.includes("SmartAPI") ||
          errorMessage.includes("JWT token") ||
          errorMessage.includes("SMARTAPI")
        ) {
          errorMessage = "SmartAPI credentials not configured";
        }
        setError(errorMessage);
        // Only log to console, don't show technical errors to user
        if (!errorMessage.includes("SmartAPI credentials not configured")) {
          console.error("API Error:", errorMessage, "Status:", resp.status);
        }
      }
    } catch (e: any) {
      const errorMessage =
        e.message ||
        "Network error. Make sure backend is running on port 5000.";
      setError(errorMessage);
      console.error("Failed to fetch returns data:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchADFTest = async () => {
    if (!selectedSymbol) return;
    setLoadingADF(true);
    try {
      const resp = await fetch(
        `/api/dsfm/adf-test?symbol=${selectedSymbol}&timeframe=${timeframe}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        setAdfResult(data);
      } else {
        const errorData = await resp
          .json()
          .catch(() => ({ error: `HTTP ${resp.status}` }));
        const errorMsg =
          errorData.error || errorData.message || "Unknown error";
        // Only log SmartAPI errors silently, don't spam console
        if (!errorMsg.includes("SmartAPI") && !errorMsg.includes("JWT token")) {
          console.error("ADF test error:", errorMsg);
        }
      }
    } catch (e: any) {
      // Only log non-network errors
      if (!e.message?.includes("Network")) {
        console.error("Failed to fetch ADF test:", e);
      }
    } finally {
      setLoadingADF(false);
    }
  };

  const renderPriceChart = (prices: number[], timestamps?: string[]) => {
    if (!priceChartRef.current || prices.length === 0) return;

    const chart = createChart(priceChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#374151",
      },
      width: priceChartRef.current.clientWidth,
      height: 300,
      grid: {
        vertLines: { color: "transparent" },
        horzLines: { color: "#e5e7eb" },
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#3b82f6",
      topColor: "rgba(59, 130, 246, 0.3)",
      bottomColor: "rgba(59, 130, 246, 0.05)",
      lineWidth: 2,
    });

    // Use actual timestamps if available, otherwise use index
    const useTimestamps = !!timestamps && timestamps.length === prices.length;
    if (!useTimestamps) {
      chart.applyOptions({
        timeScale: {
          tickMarkFormatter: (t: Time | number) =>
            `${typeof t === "number" ? t : ""}`,
        },
      });
    }

    const chartData = prices.map((price, index) => {
      if (useTimestamps && timestamps && timestamps[index]) {
        // Convert timestamp string to Unix timestamp (seconds)
        const date = new Date(timestamps[index]);
        return {
          time: Math.floor(date.getTime() / 1000) as Time,
          value: price,
        };
      }
      // Fallback to index if no timestamps
      return {
        time: index as Time,
        value: price,
      };
    });
    series.setData(chartData);
    chart.timeScale().fitContent();
  };

  const renderReturnsChart = (returns: number[], timestamps?: string[]) => {
    if (!returnsChartRef.current || returns.length === 0) return;

    const chart = createChart(returnsChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#374151",
      },
      width: returnsChartRef.current.clientWidth,
      height: 300,
      grid: {
        vertLines: { color: "transparent" },
        horzLines: { color: "#e5e7eb" },
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#10b981",
      topColor: "rgba(16, 185, 129, 0.3)",
      bottomColor: "rgba(16, 185, 129, 0.05)",
      lineWidth: 2,
    });

    // Use actual timestamps if available (skip first timestamp since returns start from index 1)
    const useTimestamps =
      !!timestamps && timestamps.length >= returns.length + 1;
    if (!useTimestamps) {
      chart.applyOptions({
        timeScale: {
          tickMarkFormatter: (t: Time | number) =>
            `${typeof t === "number" ? t : ""}`,
        },
      });
    }

    const chartData = returns.map((ret, index) => {
      if (useTimestamps && timestamps && timestamps[index + 1]) {
        // Returns are calculated from index 1, so use timestamp at index + 1
        const date = new Date(timestamps[index + 1]);
        return {
          time: Math.floor(date.getTime() / 1000) as Time,
          value: ret * 100, // Convert to percentage
        };
      }
      // Fallback to index if no timestamps
      return {
        time: index as Time,
        value: ret * 100, // Convert to percentage
      };
    });
    series.setData(chartData);
    chart.timeScale().fitContent();
  };

  const renderArimaChart = (forecast: number[]) => {
    if (!arimaChartRef.current || !forecast || forecast.length === 0) return;
    arimaChartRef.current.innerHTML = "";
    if (arimaChartRef.current.clientWidth === 0) {
      setTimeout(() => renderArimaChart(forecast), 100);
      return;
    }
    const chart = createChart(arimaChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#374151",
      },
      width: arimaChartRef.current.clientWidth,
      height: 240,
      grid: {
        vertLines: { color: "#e5e7eb" },
        horzLines: { color: "#e5e7eb" },
      },
    });
    const baseTs = Math.floor(
      new Date("2000-01-01T00:00:00Z").getTime() / 1000,
    );
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        tickMarkFormatter: (t: Time | number) => {
          const ts = typeof t === "number" ? t : 0;
          const idx = ts ? Math.max(0, Math.round((ts - baseTs) / 86400)) : 0;
          return `Step ${idx}`;
        },
      },
      localization: { timeFormatter: () => "" },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      priceScaleId: "",
    });
    const chartData = forecast.map((v, i) => ({
      time: (baseTs + i * 86400) as Time,
      value: v,
    }));
    series.setData(chartData);
    chart.timeScale().fitContent();
  };

  const renderGarchVolChart = (vols: number[], forecast?: number[]) => {
    if (!garchVolChartRef.current || !vols || vols.length === 0) return;
    garchVolChartRef.current.innerHTML = "";
    if (garchVolChartRef.current.clientWidth === 0) {
      setTimeout(() => renderGarchVolChart(vols, forecast), 100);
      return;
    }
    const chart = createChart(garchVolChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#374151",
      },
      width: garchVolChartRef.current.clientWidth,
      height: 240,
      grid: {
        vertLines: { color: "#e5e7eb" },
        horzLines: { color: "#e5e7eb" },
      },
    });
    const baseTs = Math.floor(
      new Date("2000-01-01T00:00:00Z").getTime() / 1000,
    );
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        tickMarkFormatter: (t: Time | number) => {
          const ts = typeof t === "number" ? t : 0;
          const idx = ts ? Math.max(0, Math.round((ts - baseTs) / 86400)) : 0;
          return `Step ${idx}`;
        },
      },
      localization: { timeFormatter: () => "" },
    });
    const histSeries = chart.addSeries(HistogramSeries, {
      color: "#8b5cf6",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    const histData = vols.map((v, i) => ({
      time: (baseTs + i * 86400) as Time,
      value: v,
    }));
    histSeries.setData(histData);
    if (forecast && forecast.length > 0) {
      const line = chart.addSeries(LineSeries, {
        color: "#ef4444",
        lineWidth: 2,
        priceScaleId: "",
      });
      const lineData = forecast.map((v, i) => ({
        time: (baseTs + (vols.length + i) * 86400) as Time,
        value: v,
      }));
      line.setData(lineData);
    }
    chart.timeScale().fitContent();
  };

  const renderLstmChart = (forecast: number[]) => {
    if (!lstmChartRef.current || !forecast || forecast.length === 0) return;
    lstmChartRef.current.innerHTML = "";
    if (lstmChartRef.current.clientWidth === 0) {
      setTimeout(() => renderLstmChart(forecast), 100);
      return;
    }
    const chart = createChart(lstmChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#374151",
      },
      width: lstmChartRef.current.clientWidth,
      height: 240,
      grid: {
        vertLines: { color: "#e5e7eb" },
        horzLines: { color: "#e5e7eb" },
      },
    });
    const baseTs = Math.floor(
      new Date("2000-01-01T00:00:00Z").getTime() / 1000,
    );
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        tickMarkFormatter: (t: Time | number) => {
          const ts = typeof t === "number" ? t : 0;
          const idx = ts ? Math.max(0, Math.round((ts - baseTs) / 86400)) : 0;
          return `Step ${idx}`;
        },
      },
      localization: { timeFormatter: () => "" },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#8b5cf6",
      lineWidth: 2,
      priceScaleId: "",
    });
    const chartData = forecast.map((v, i) => ({
      time: (baseTs + i * 86400) as Time,
      value: v,
    }));
    series.setData(chartData);
    chart.timeScale().fitContent();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Returns Analysis & Time-Series Modeling</CardTitle>
          <CardDescription>
            Analyze log returns, distribution properties, statistical measures,
            and time-series models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Select Stock
              </label>
              <Select
                value={selectedSymbol}
                onValueChange={(value) => setSelectedSymbol(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stock" />
                </SelectTrigger>

                <SelectContent>
                  {symbols.map((sym) => (
                    <SelectItem key={sym} value={sym}>
                      {sym}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium mb-2 block">
                Timeframe
              </label>
              <Select
                value={timeframe}
                onValueChange={(value) => setTimeframe(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="1W">1 Week</SelectItem>
                  <SelectItem value="1M">1 Month</SelectItem>
                  <SelectItem value="3M">3 Months</SelectItem>
                  <SelectItem value="6M">6 Months</SelectItem>
                  <SelectItem value="1Y">1 Year</SelectItem>
                  <SelectItem value="2Y">2 Years</SelectItem>
                  <SelectItem value="3Y">3 Years</SelectItem>
                  <SelectItem value="5Y">5 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : returnsData ? (
            <>
              {/* Statistical Measures */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Mean Return
                        </p>
                        <p className="text-2xl font-bold">
                          {(returnsData.meanReturn * 100).toFixed(2)}%
                        </p>
                        {returnsData.calculations && (
                          <p className="text-xs text-gray-500 mt-1">
                            {returnsData.calculations.meanReturn.description}
                          </p>
                        )}
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Volatility (σ)
                        </p>
                        <p className="text-2xl font-bold">
                          {(returnsData.volatility * 100).toFixed(2)}%
                        </p>
                        {returnsData.calculations && (
                          <p className="text-xs text-gray-500 mt-1">
                            {returnsData.calculations.volatility.description}
                          </p>
                        )}
                      </div>
                      <Activity className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sharpe Ratio
                        </p>
                        <p className="text-2xl font-bold">
                          {returnsData.sharpeRatio.toFixed(2)}
                        </p>
                        {returnsData.calculations && (
                          <p className="text-xs text-gray-500 mt-1">
                            {returnsData.calculations.sharpeRatio.description}
                          </p>
                        )}
                      </div>
                      <BarChart3 className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Range
                        </p>
                        <p className="text-sm font-semibold">
                          {(returnsData.minReturn * 100).toFixed(2)}% to{" "}
                          {(returnsData.maxReturn * 100).toFixed(2)}%
                        </p>
                        {returnsData.calculations && (
                          <p className="text-xs text-gray-500 mt-1">
                            {returnsData.calculations.range.description}
                          </p>
                        )}
                      </div>
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Calculation Explanations */}
              {returnsData.calculations && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      How These Metrics Are Calculated
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-semibold">Mean Return (μ)</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Formula: μ = (1/n) × Σ(log returns)
                          </p>
                          <p className="text-xs text-gray-500">
                            Average of all daily log returns. Shows expected
                            daily return.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-semibold">Volatility (σ)</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Formula: σ = √(Σ(returns - μ)² / n)
                          </p>
                          <p className="text-xs text-gray-500">
                            Standard deviation of returns. Measures
                            risk/uncertainty. Higher = more volatile.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-semibold">Sharpe Ratio</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Formula: Sharpe = (μ_annual - r_f) / σ_annual
                          </p>
                          <p className="text-xs text-gray-500">
                            Risk-adjusted return. Compares excess return to
                            volatility. &gt;1 is good, &gt;2 is excellent.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-semibold">Range</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Formula: [min(returns), max(returns)]
                          </p>
                          <p className="text-xs text-gray-500">
                            Minimum and maximum daily returns observed in the
                            period.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="charts" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="charts">Charts</TabsTrigger>
                  <TabsTrigger value="stationarity">ADF Test</TabsTrigger>
                  <TabsTrigger value="models">ARIMA/GARCH</TabsTrigger>
                  <TabsTrigger value="lstm">LSTM</TabsTrigger>
                  <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
                </TabsList>

                <TabsContent value="charts" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Stock Price Chart</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div ref={priceChartRef} className="w-full h-75" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Log Returns Chart</CardTitle>
                      <CardDescription>
                        Daily log returns: ln(Pₜ / Pₜ₋₁)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div ref={returnsChartRef} className="w-full h-75" />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stationarity" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Augmented Dickey-Fuller (ADF) Test</CardTitle>
                      <CardDescription>
                        Tests for stationarity of log returns. Null hypothesis:
                        series has a unit root (non-stationary)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingADF ? (
                        <Skeleton className="h-32 w-full" />
                      ) : adfResult ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            {adfResult.isStationary ? (
                              <>
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <Badge className="bg-green-100 text-green-800">
                                  Stationary
                                </Badge>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-5 w-5 text-red-500" />
                                <Badge className="bg-red-100 text-red-800">
                                  Non-Stationary
                                </Badge>
                              </>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Test Statistic
                              </p>
                              <p className="text-lg font-bold">
                                {adfResult.testStatistic.toFixed(4)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                P-Value
                              </p>
                              <p className="text-lg font-bold">
                                {adfResult.pValue === 0 ||
                                adfResult.pValue < 0.0001
                                  ? "< 0.0001"
                                  : adfResult.pValue.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold mb-2">
                              Critical Values
                            </p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-sm">1%:</span>
                                <span className="text-sm font-mono">
                                  {adfResult.criticalValues["1%"].toFixed(4)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm">5%:</span>
                                <span className="text-sm font-mono">
                                  {adfResult.criticalValues["5%"].toFixed(4)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm">10%:</span>
                                <span className="text-sm font-mono">
                                  {adfResult.criticalValues["10%"].toFixed(4)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm font-semibold mb-1">
                              Interpretation:
                            </p>
                            <p className="text-sm">
                              {adfResult.interpretation}
                            </p>
                            <p className="text-sm mt-2 font-semibold">
                              Recommendation:
                            </p>
                            <p className="text-sm">
                              {adfResult.recommendation}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Click to run ADF test
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="models" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>AR/MA/ARIMA Models</CardTitle>
                      <CardDescription>
                        Autoregressive (AR), Moving Average (MA), and ARIMA
                        models for time-series forecasting
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label
                            htmlFor="ar-order"
                            className="text-xs text-gray-600 dark:text-gray-400"
                          >
                            AR order (p)
                          </label>

                          <input
                            id="ar-order"
                            type="number"
                            min="0"
                            max="5"
                            defaultValue="1"
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="diff-order"
                            className="text-xs text-gray-600 dark:text-gray-400"
                          >
                            Differencing (d)
                          </label>

                          <input
                            id="diff-order"
                            type="number"
                            min="0"
                            max="2"
                            defaultValue="0"
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="ma-order"
                            className="text-xs text-gray-600 dark:text-gray-400"
                          >
                            MA order (q)
                          </label>

                          <input
                            id="ma-order"
                            type="number"
                            min="0"
                            max="5"
                            defaultValue="1"
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={async () => {
                          const p = parseInt(
                            (
                              document.getElementById(
                                "ar-order",
                              ) as HTMLInputElement
                            )?.value || "1",
                          );
                          const d = parseInt(
                            (
                              document.getElementById(
                                "diff-order",
                              ) as HTMLInputElement
                            )?.value || "0",
                          );
                          const q = parseInt(
                            (
                              document.getElementById(
                                "ma-order",
                              ) as HTMLInputElement
                            )?.value || "1",
                          );
                          setLoadingARIMA(true);
                          setArimaResult(null);
                          try {
                            // Use longer timeframe for ARIMA if current timeframe is too short
                            const arimaTimeframe =
                              timeframe === "1M" ? "1Y" : timeframe;
                            const resp = await fetch("/api/dsfm/arima", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                symbol: selectedSymbol,
                                timeframe: arimaTimeframe,
                                order: [p, d, q],
                              }),
                            });
                            if (resp.ok) {
                              const data = await resp.json();
                              setArimaResult(data);
                              console.log("ARIMA Model Results:", data);
                            } else {
                              const errorData = await resp.json().catch(() => ({
                                error: `HTTP ${resp.status}`,
                              }));
                              const errorMsg =
                                errorData.message ||
                                errorData.error ||
                                "Unknown error";
                              alert(`ARIMA Model Error: ${errorMsg}`);
                            }
                          } catch (e: any) {
                            console.error("ARIMA model error:", e);
                            alert(
                              `ARIMA Model Error: ${e.message || "Network error"}`,
                            );
                          } finally {
                            setLoadingARIMA(false);
                          }
                        }}
                        disabled={loadingARIMA}
                      >
                        {loadingARIMA ? "Fitting Model..." : "Fit ARIMA Model"}
                      </Button>
                      {arimaResult && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-2">
                          <p className="font-semibold text-green-800 dark:text-green-200">
                            ARIMA Model Results
                          </p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                AIC:
                              </span>
                              <span className="ml-2 font-mono font-bold">
                                {arimaResult.aic?.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                BIC:
                              </span>
                              <span className="ml-2 font-mono font-bold">
                                {arimaResult.bic?.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {arimaResult.forecast && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                5-Step Forecast:
                              </p>
                              <p className="text-xs font-mono">
                                {arimaResult.forecast
                                  .map((f: number) => f.toFixed(4))
                                  .join(", ")}
                              </p>
                              <div
                                ref={arimaChartRef}
                                className="w-full mt-2 h-60"
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        ARIMA(p,d,q): p=autoregressive terms, d=differencing,
                        q=moving average terms. Note: Using 1Y timeframe for
                        ARIMA models to ensure sufficient data (minimum 30
                        candles required).
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>ARCH/GARCH Models</CardTitle>
                      <CardDescription>
                        Autoregressive Conditional Heteroskedasticity models for
                        volatility clustering
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor="garch-p"
                            className="text-xs text-gray-600 dark:text-gray-400"
                          >
                            GARCH p (ARCH terms)
                          </label>

                          <input
                            id="garch-p"
                            type="number"
                            min="1"
                            max="3"
                            defaultValue="1"
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="garch-q"
                            className="text-xs text-gray-600 dark:text-gray-400"
                          >
                            GARCH q (GARCH terms)
                          </label>

                          <input
                            id="garch-q"
                            type="number"
                            min="1"
                            max="3"
                            defaultValue="1"
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={async () => {
                          const p = parseInt(
                            (
                              document.getElementById(
                                "garch-p",
                              ) as HTMLInputElement
                            )?.value || "1",
                          );
                          const q = parseInt(
                            (
                              document.getElementById(
                                "garch-q",
                              ) as HTMLInputElement
                            )?.value || "1",
                          );
                          setLoadingGARCH(true);
                          setGarchResult(null);
                          try {
                            // Use longer timeframe for GARCH if current timeframe is too short
                            const garchTimeframe =
                              timeframe === "1M" ? "1Y" : timeframe;
                            const resp = await fetch("/api/dsfm/garch", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                symbol: selectedSymbol,
                                timeframe: garchTimeframe,
                                order: [p, q],
                              }),
                            });
                            if (resp.ok) {
                              const data = await resp.json();
                              setGarchResult(data);
                              console.log("GARCH Model Results:", data);
                            } else {
                              const errorData = await resp.json().catch(() => ({
                                error: `HTTP ${resp.status}`,
                              }));
                              const errorMsg =
                                errorData.message ||
                                errorData.error ||
                                "Unknown error";
                              alert(`GARCH Model Error: ${errorMsg}`);
                            }
                          } catch (e: any) {
                            console.error("GARCH model error:", e);
                            alert(
                              `GARCH Model Error: ${e.message || "Network error"}`,
                            );
                          } finally {
                            setLoadingGARCH(false);
                          }
                        }}
                        disabled={loadingGARCH}
                      >
                        {loadingGARCH ? "Fitting Model..." : "Fit GARCH Model"}
                      </Button>
                      {garchResult && (
                        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg space-y-2">
                          <p className="font-semibold text-purple-800 dark:text-purple-200">
                            GARCH Model Results
                          </p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                AIC:
                              </span>
                              <span className="ml-2 font-mono font-bold">
                                {garchResult.aic?.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                BIC:
                              </span>
                              <span className="ml-2 font-mono font-bold">
                                {garchResult.bic?.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {garchResult.forecast && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Volatility Forecast (5 steps):
                              </p>
                              <p className="text-xs font-mono">
                                {garchResult.forecast
                                  .map((f: number) => f.toFixed(4))
                                  .join(", ")}
                              </p>
                              <div
                                ref={garchVolChartRef}
                                className="w-full mt-2 h-60"
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        GARCH(p,q): Models volatility clustering. p=ARCH terms,
                        q=GARCH terms. Note: Using 1Y timeframe for GARCH models
                        to ensure sufficient data (minimum 50 candles required).
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="lstm" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        LSTM (Long Short-Term Memory) Forecasting
                      </CardTitle>
                      <CardDescription>
                        Deep learning model for time series forecasting using
                        recurrent neural networks
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
                            max="30"
                            defaultValue="10"
                            className="w-full px-2 py-1 border rounded text-sm"
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
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={async () => {
                          const lookback = parseInt(
                            (
                              document.getElementById(
                                "lstm-lookback",
                              ) as HTMLInputElement
                            )?.value || "10",
                          );
                          const steps = parseInt(
                            (
                              document.getElementById(
                                "lstm-steps",
                              ) as HTMLInputElement
                            )?.value || "5",
                          );
                          setLoadingLSTM(true);
                          setLstmResult(null);
                          try {
                            const resp = await fetch("/api/dsfm/lstm", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                symbol: selectedSymbol,
                                timeframe: "1Y",
                                lookback,
                                forecastSteps: steps,
                              }),
                            });
                            if (resp.ok) {
                              const data = await resp.json();
                              setLstmResult(data);
                            } else {
                              const errorData = await resp.json().catch(() => ({
                                error: `HTTP ${resp.status}`,
                              }));
                              alert(
                                `LSTM Error: ${errorData.error || errorData.message || "Unknown error"}`,
                              );
                            }
                          } catch (e: any) {
                            alert(
                              `LSTM Error: ${e.message || "Network error"}`,
                            );
                          } finally {
                            setLoadingLSTM(false);
                          }
                        }}
                        disabled={loadingLSTM}
                      >
                        {loadingLSTM
                          ? "Training Model..."
                          : "Run LSTM Forecast"}
                      </Button>
                      {lstmResult && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
                          <p className="font-semibold text-blue-800 dark:text-blue-200">
                            LSTM Forecast Results
                          </p>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                RMSE:
                              </span>
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
                              <p className="text-xs font-mono">
                                {lstmResult.forecast
                                  .map((f: number) => f.toFixed(4))
                                  .join(", ")}
                              </p>
                              <div
                                ref={lstmChartRef}
                                className="w-full mt-2 h-60"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="sentiment" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Sentiment Analysis</CardTitle>
                      <CardDescription>
                        Analyze financial sentiment using FinBERT and rule-based
                        methods
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <label className="text-sm font-semibold mb-3 block text-gray-700 dark:text-gray-300">
                          Enter Text for Analysis
                        </label>
                        <textarea
                          value={sentimentText}
                          onChange={(e) => setSentimentText(e.target.value)}
                          placeholder="Enter financial news, analysis, or commentary..."
                          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm min-h-30 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all resize-none bg-white dark:bg-gray-800"
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={async () => {
                            if (!sentimentText.trim()) {
                              alert("Please enter some text for analysis");
                              return;
                            }
                            setLoadingFinBERT(true);
                            setFinbertResult(null);
                            try {
                              const resp = await fetch(
                                "/api/dsfm/sentiment/finbert",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ text: sentimentText }),
                                },
                              );
                              if (resp.ok) {
                                const data = await resp.json();
                                setFinbertResult(data);
                              } else {
                                const errorData = await resp
                                  .json()
                                  .catch(() => ({
                                    error: `HTTP ${resp.status}`,
                                  }));
                                alert(
                                  `FinBERT Error: ${errorData.error || errorData.message || "Unknown error"}`,
                                );
                              }
                            } catch (e: any) {
                              alert(
                                `FinBERT Error: ${e.message || "Network error"}`,
                              );
                            } finally {
                              setLoadingFinBERT(false);
                            }
                          }}
                          disabled={loadingFinBERT || !sentimentText.trim()}
                          className="flex-1 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                        >
                          {loadingFinBERT ? "Analyzing..." : "FinBERT Analysis"}
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!sentimentText.trim()) {
                              alert("Please enter some text for analysis");
                              return;
                            }
                            setLoadingRuleSentiment(true);
                            setRuleSentimentResult(null);
                            try {
                              const resp = await fetch(
                                "/api/dsfm/sentiment/rule-based",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ text: sentimentText }),
                                },
                              );
                              if (resp.ok) {
                                const data = await resp.json();
                                setRuleSentimentResult(data);
                              } else {
                                const errorData = await resp
                                  .json()
                                  .catch(() => ({
                                    error: `HTTP ${resp.status}`,
                                  }));
                                alert(
                                  `Rule-based Error: ${errorData.error || errorData.message || "Unknown error"}`,
                                );
                              }
                            } catch (e: any) {
                              alert(
                                `Rule-based Error: ${e.message || "Network error"}`,
                              );
                            } finally {
                              setLoadingRuleSentiment(false);
                            }
                          }}
                          disabled={
                            loadingRuleSentiment || !sentimentText.trim()
                          }
                          variant="outline"
                          className="flex-1 border-2"
                        >
                          {loadingRuleSentiment
                            ? "Analyzing..."
                            : "Rule-Based Analysis"}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {finbertResult && (
                          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-linear-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-900 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <p className="font-bold text-lg text-blue-900 dark:text-blue-200">
                                FinBERT Results
                              </p>
                              <Badge
                                className={`text-xs px-3 py-1 ${finbertResult.sentiment === "positive" ? "bg-green-500 hover:bg-green-600" : finbertResult.sentiment === "negative" ? "bg-red-500 hover:bg-red-600" : "bg-gray-500 hover:bg-gray-600"}`}
                              >
                                {finbertResult.sentiment}
                              </Badge>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Score
                                </span>
                                <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
                                  {finbertResult.score?.toFixed(3)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Confidence
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-linear-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                                      style={{
                                        width: `${finbertResult.confidence * 100}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
                                    {(finbertResult.confidence * 100)?.toFixed(
                                      1,
                                    )}
                                    %
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {ruleSentimentResult && (
                          <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-linear-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-900 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <p className="font-bold text-lg text-purple-900 dark:text-purple-200">
                                Rule-Based Results
                              </p>
                              <Badge
                                className={`text-xs px-3 py-1 ${ruleSentimentResult.sentiment === "bullish" ? "bg-green-500 hover:bg-green-600" : ruleSentimentResult.sentiment === "bearish" ? "bg-red-500 hover:bg-red-600" : "bg-gray-500 hover:bg-gray-600"}`}
                              >
                                {ruleSentimentResult.sentiment}
                              </Badge>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Bullish Signals
                                </span>
                                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                  {ruleSentimentResult.bullish_signals}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Bearish Signals
                                </span>
                                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                                  {ruleSentimentResult.bearish_signals}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Confidence
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-linear-to-r from-purple-500 to-purple-600 rounded-full transition-all"
                                      style={{
                                        width: `${ruleSentimentResult.confidence * 100}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
                                    {(
                                      ruleSentimentResult.confidence * 100
                                    )?.toFixed(1)}
                                    %
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : !loading ? (
            <div className="text-center py-8">
              {error ? (
                <div className="space-y-4">
                  {error.includes("SmartAPI credentials not configured") ? (
                    <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                      <CardHeader>
                        <CardTitle className="text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                          <Info className="h-5 w-5" />
                          SmartAPI Credentials Required
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-left space-y-3">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          To fetch real-time stock data, you need to configure
                          your Angel One SmartAPI credentials.
                        </p>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs font-mono space-y-1">
                          <p className="font-semibold mb-2">
                            Add these to{" "}
                            <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                              backend/.env
                            </code>
                            :
                          </p>
                          <p>SMARTAPI_API_KEY=your_api_key</p>
                          <p>SMARTAPI_CLIENT_CODE=your_client_code</p>
                          <p>SMARTAPI_PASSWORD=your_password</p>
                          <p>SMARTAPI_TOTP_SECRET=your_totp_secret</p>
                        </div>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                          After adding credentials, restart the backend server.
                        </p>
                        <p className="text-xs text-gray-500">
                          Get your credentials from:{" "}
                          <a
                            href="https://smartapi.angelone.in/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Angel One SmartAPI
                          </a>
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-red-600 dark:text-red-400 font-semibold">
                        Error loading data
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                        {error}
                      </p>
                      {error.includes("port 5000") ||
                      error.includes("Network error") ? (
                        <p className="text-xs text-gray-500 mt-2">
                          Make sure the backend server is running on port 5000
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : selectedSymbol ? (
                <p className="text-gray-500">
                  No data available for {selectedSymbol}
                </p>
              ) : (
                <p className="text-gray-500">
                  Select a stock to view returns analysis
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
