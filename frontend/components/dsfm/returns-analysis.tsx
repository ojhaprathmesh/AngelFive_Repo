"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, Activity, Info, CheckCircle, XCircle } from "lucide-react";
import { createChart, IChartApi, ISeriesApi, ColorType, LineStyle, Time, AreaSeries, HistogramSeries, LineSeries } from "lightweight-charts";

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
    range: { formula: string; description: string; value: { min: number; max: number } };
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
  const [acfPacfData, setAcfPacfData] = useState<ACFPACFData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingADF, setLoadingADF] = useState(false);
  const [loadingACF, setLoadingACF] = useState(false);
  const [loadingARIMA, setLoadingARIMA] = useState(false);
  const [loadingGARCH, setLoadingGARCH] = useState(false);
  const [timeframe, setTimeframe] = useState<string>("1M");
  const [error, setError] = useState<string | null>(null);
  const [arimaResult, setArimaResult] = useState<any>(null);
  const [garchResult, setGarchResult] = useState<any>(null);
  
  const priceChartRef = useRef<HTMLDivElement>(null);
  const returnsChartRef = useRef<HTMLDivElement>(null);
  const acfChartRef = useRef<HTMLDivElement>(null);
  const pacfChartRef = useRef<HTMLDivElement>(null);
  const arimaChartRef = useRef<HTMLDivElement>(null);
  const garchVolChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const popularStocks = [
      "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN",
      "BHARTIARTL", "ITC", "KOTAKBANK", "LT", "AXISBANK", "ASIANPAINT", "MARUTI",
      "TITAN", "ULTRACEMCO", "NESTLEIND", "BAJFINANCE", "WIPRO", "ONGC", "TATAMOTORS",
      "NTPC", "POWERGRID", "INDUSINDBK", "TECHM", "HCLTECH", "SUNPHARMA", "COALINDIA"
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
      fetchACFPACF();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, timeframe]);

  // Re-render ACF/PACF charts when data changes or tabs become visible
  useEffect(() => {
    if (acfPacfData && acfPacfData.lags && acfPacfData.acf && acfPacfData.pacf) {
      // Wait a bit for tab to become visible
      const timer = setTimeout(() => {
        if (acfChartRef.current && pacfChartRef.current) {
          if (acfChartRef.current.clientWidth > 0 && pacfChartRef.current.clientWidth > 0) {
            console.log("Re-rendering ACF/PACF charts with data:", {
              lagsCount: acfPacfData.lags?.length,
              acfCount: acfPacfData.acf?.length,
              pacfCount: acfPacfData.pacf?.length
            });
            renderACFChart(acfPacfData);
            renderPACFChart(acfPacfData);
          } else {
            console.warn("Chart containers not visible yet, will retry...");
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acfPacfData]);

  useEffect(() => {
    if (arimaResult && Array.isArray(arimaResult.forecast)) {
      setTimeout(() => renderArimaChart(arimaResult.forecast), 100);
    }
  }, [arimaResult]);

  useEffect(() => {
    if (garchResult && Array.isArray(garchResult.conditionalVolatility)) {
      setTimeout(() => renderGarchVolChart(garchResult.conditionalVolatility, garchResult.forecast), 100);
    }
  }, [garchResult]);

  const fetchReturnsData = async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    setReturnsData(null);
    setError(null);
    try {
      const resp = await fetch(`/api/dsfm/returns?symbol=${selectedSymbol}&timeframe=${timeframe}`);
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
                errorMessage = jsonData.error || jsonData.message || errorMessage;
              } catch {
                errorMessage = text;
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }
        setError(errorMessage);
        console.error("API Error:", errorMessage, "Status:", resp.status);
      }
    } catch (e: any) {
      const errorMessage = e.message || "Network error. Make sure backend is running on port 5000.";
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
      const resp = await fetch(`/api/dsfm/adf-test?symbol=${selectedSymbol}&timeframe=${timeframe}`);
      if (resp.ok) {
        const data = await resp.json();
        setAdfResult(data);
      } else {
        const errorData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        console.error("ADF test error:", errorData.error || errorData.message);
      }
    } catch (e: any) {
      console.error("Failed to fetch ADF test:", e);
    } finally {
      setLoadingADF(false);
    }
  };

  const fetchACFPACF = async () => {
    if (!selectedSymbol) return;
    setLoadingACF(true);
    setAcfPacfData(null);
    try {
      const resp = await fetch(`/api/dsfm/acf-pacf?symbol=${selectedSymbol}&timeframe=${timeframe}&maxLags=20`);
      if (resp.ok) {
        const data = await resp.json();
        console.log("ACF/PACF data received:", data);
        setAcfPacfData(data);
        // Clear previous charts before rendering new ones
        if (acfChartRef.current) {
          acfChartRef.current.innerHTML = '';
        }
        if (pacfChartRef.current) {
          pacfChartRef.current.innerHTML = '';
        }
        // Render charts after a short delay to ensure DOM is ready
        setTimeout(() => {
          if (data.lags && data.acf && data.pacf && acfChartRef.current && pacfChartRef.current) {
            renderACFChart(data);
            renderPACFChart(data);
          } else {
            setAcfPacfData(null);
          }
        }, 500);
      } else {
        const errorData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        console.error("ACF/PACF error:", errorData.error || errorData.message);
        setAcfPacfData(null);
      }
    } catch (e: any) {
      console.error("Failed to fetch ACF/PACF:", e);
      setAcfPacfData(null);
    } finally {
      setLoadingACF(false);
    }
  };

  const renderPriceChart = (prices: number[], timestamps?: string[]) => {
    if (!priceChartRef.current || prices.length === 0) return;
    
    const chart = createChart(priceChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#374151" },
      width: priceChartRef.current.clientWidth,
      height: 300,
      grid: { vertLines: { color: "transparent" }, horzLines: { color: "#e5e7eb" } },
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
      chart.applyOptions({ timeScale: { tickMarkFormatter: (t) => `${typeof t === 'number' ? t : ''}` } });
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
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#374151" },
      width: returnsChartRef.current.clientWidth,
      height: 300,
      grid: { vertLines: { color: "transparent" }, horzLines: { color: "#e5e7eb" } },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#10b981",
      topColor: "rgba(16, 185, 129, 0.3)",
      bottomColor: "rgba(16, 185, 129, 0.05)",
      lineWidth: 2,
    });
    
    // Use actual timestamps if available (skip first timestamp since returns start from index 1)
    const useTimestamps = !!timestamps && timestamps.length >= returns.length + 1;
    if (!useTimestamps) {
      chart.applyOptions({ timeScale: { tickMarkFormatter: (t) => `${typeof t === 'number' ? t : ''}` } });
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

  const renderACFChart = (data: ACFPACFData) => {
    if (!acfChartRef.current || !data.lags || !data.acf) {
      console.error("Cannot render ACF chart: missing data or ref", { lags: data.lags, acf: data.acf });
      return;
    }
    
    // Clear previous chart
    acfChartRef.current.innerHTML = '';
    
    // Wait for container to have width
    if (acfChartRef.current.clientWidth === 0) {
      console.warn("ACF chart container has no width, retrying...");
      setTimeout(() => renderACFChart(data), 100);
      return;
    }
    
    const chart = createChart(acfChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#374151" },
      width: acfChartRef.current.clientWidth,
      height: 300,
      grid: { vertLines: { color: "#e5e7eb" }, horzLines: { color: "#e5e7eb" } },
    });
    chart.applyOptions({ timeScale: { tickMarkFormatter: (t) => `${typeof t === 'number' ? t : ''}` } });

    const series = chart.addSeries(HistogramSeries, {
      color: "#3b82f6",
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    
    // Convert lags to proper Time format (use sequential index, not lag value)
    const chartData = data.lags.map((lag, i) => ({
      time: i as Time,
      value: data.acf[i] || 0,
    }));
    series.setData(chartData);
    
    // Add confidence interval lines
    const ci = data.confidenceInterval || (1.96 / Math.sqrt(data.lags.length));
    const upperCI = chart.addSeries(LineSeries, {
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: '',
    });
    const lowerCI = chart.addSeries(LineSeries, {
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: '',
    });
    const ciData = data.lags.map((_, i) => ({ time: i as Time, value: ci }));
    const negCIData = data.lags.map((_, i) => ({ time: i as Time, value: -ci }));
    upperCI.setData(ciData);
    lowerCI.setData(negCIData);
    
    chart.timeScale().fitContent();
  };

  const renderPACFChart = (data: ACFPACFData) => {
    if (!pacfChartRef.current || !data.lags || !data.pacf) {
      console.error("Cannot render PACF chart: missing data or ref", { lags: data.lags, pacf: data.pacf });
      return;
    }
    
    // Clear previous chart
    pacfChartRef.current.innerHTML = '';
    
    // Wait for container to have width
    if (pacfChartRef.current.clientWidth === 0) {
      console.warn("PACF chart container has no width, retrying...");
      setTimeout(() => renderPACFChart(data), 100);
      return;
    }
    
    const chart = createChart(pacfChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#374151" },
      width: pacfChartRef.current.clientWidth,
      height: 300,
      grid: { vertLines: { color: "#e5e7eb" }, horzLines: { color: "#e5e7eb" } },
    });
    chart.applyOptions({ timeScale: { tickMarkFormatter: (t) => `${typeof t === 'number' ? t : ''}` } });

    const series = chart.addSeries(HistogramSeries, {
      color: "#8b5cf6",
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    
    // Convert lags to proper Time format (use sequential index, not lag value)
    const chartData = data.lags.map((lag, i) => ({
      time: i as Time,
      value: data.pacf[i] || 0,
    }));
    series.setData(chartData);
    
    // Add confidence interval lines
    const ci = data.confidenceInterval || (1.96 / Math.sqrt(data.lags.length));
    const upperCI = chart.addSeries(LineSeries, {
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: '',
    });
    const lowerCI = chart.addSeries(LineSeries, {
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: '',
    });
    const ciData = data.lags.map((_, i) => ({ time: i as Time, value: ci }));
    const negCIData = data.lags.map((_, i) => ({ time: i as Time, value: -ci }));
    upperCI.setData(ciData);
    lowerCI.setData(negCIData);
    
    chart.timeScale().fitContent();
  };

  const renderArimaChart = (forecast: number[]) => {
    if (!arimaChartRef.current || !forecast || forecast.length === 0) return;
    arimaChartRef.current.innerHTML = '';
    if (arimaChartRef.current.clientWidth === 0) {
      setTimeout(() => renderArimaChart(forecast), 100);
      return;
    }
    const chart = createChart(arimaChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#374151" },
      width: arimaChartRef.current.clientWidth,
      height: 240,
      grid: { vertLines: { color: "#e5e7eb" }, horzLines: { color: "#e5e7eb" } },
    });
    const baseTs = Math.floor(new Date('2000-01-01T00:00:00Z').getTime() / 1000);
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        tickMarkFormatter: (t) => {
          const ts = typeof t === 'number' ? t : 0;
          const idx = ts ? Math.max(0, Math.round((ts - baseTs) / 86400)) : 0;
          return `Step ${idx}`;
        },
      },
      localization: { timeFormatter: () => '' },
    });
    const series = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, priceScaleId: '' });
    const chartData = forecast.map((v, i) => ({ time: (baseTs + i * 86400) as Time, value: v }));
    series.setData(chartData);
    chart.timeScale().fitContent();
  };

  const renderGarchVolChart = (vols: number[], forecast?: number[]) => {
    if (!garchVolChartRef.current || !vols || vols.length === 0) return;
    garchVolChartRef.current.innerHTML = '';
    if (garchVolChartRef.current.clientWidth === 0) {
      setTimeout(() => renderGarchVolChart(vols, forecast), 100);
      return;
    }
    const chart = createChart(garchVolChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#374151" },
      width: garchVolChartRef.current.clientWidth,
      height: 240,
      grid: { vertLines: { color: "#e5e7eb" }, horzLines: { color: "#e5e7eb" } },
    });
    const baseTs = Math.floor(new Date('2000-01-01T00:00:00Z').getTime() / 1000);
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        tickMarkFormatter: (t) => {
          const ts = typeof t === 'number' ? t : 0;
          const idx = ts ? Math.max(0, Math.round((ts - baseTs) / 86400)) : 0;
          return `Step ${idx}`;
        },
      },
      localization: { timeFormatter: () => '' },
    });
    const histSeries = chart.addSeries(HistogramSeries, { color: "#8b5cf6", priceFormat: { type: 'volume' }, priceScaleId: '' });
    const histData = vols.map((v, i) => ({ time: (baseTs + i * 86400) as Time, value: v }));
    histSeries.setData(histData);
    if (forecast && forecast.length > 0) {
      const line = chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, priceScaleId: '' });
      const lineData = forecast.map((v, i) => ({ time: (baseTs + (vols.length + i) * 86400) as Time, value: v }));
      line.setData(lineData);
    }
    chart.timeScale().fitContent();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Returns Analysis & Time-Series Modeling</CardTitle>
          <CardDescription>
            Analyze log returns, distribution properties, statistical measures, and time-series models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Select Stock</label>
              <Select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}>
                <SelectValue placeholder="Select a stock" />
                {symbols.map((sym) => (
                  <SelectItem key={sym} value={sym}>
                    {sym}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="w-32">
              <label className="text-sm font-medium mb-2 block">Timeframe</label>
              <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                <SelectValue />
                <SelectItem value="1W">1 Week</SelectItem>
                <SelectItem value="1M">1 Month</SelectItem>
                <SelectItem value="3M">3 Months</SelectItem>
                <SelectItem value="1Y">1 Year</SelectItem>
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">Mean Return</p>
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">Volatility (σ)</p>
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</p>
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">Range</p>
                        <p className="text-sm font-semibold">
                          {(returnsData.minReturn * 100).toFixed(2)}% to {(returnsData.maxReturn * 100).toFixed(2)}%
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
                    <CardTitle className="text-lg">How These Metrics Are Calculated</CardTitle>
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
                            Average of all daily log returns. Shows expected daily return.
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
                            Standard deviation of returns. Measures risk/uncertainty. Higher = more volatile.
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
                            Risk-adjusted return. Compares excess return to volatility. &gt;1 is good, &gt;2 is excellent.
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
                            Minimum and maximum daily returns observed in the period.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="charts" className="w-full">
                <TabsList>
                  <TabsTrigger value="charts">Price & Returns Charts</TabsTrigger>
                  <TabsTrigger value="stationarity">Stationarity (ADF Test)</TabsTrigger>
                  <TabsTrigger value="acf-pacf">ACF/PACF</TabsTrigger>
                  <TabsTrigger value="models">AR/MA/ARIMA/GARCH</TabsTrigger>
                </TabsList>

                <TabsContent value="charts" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Stock Price Chart</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div ref={priceChartRef} className="w-full" style={{ height: "300px" }} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Log Returns Chart</CardTitle>
                      <CardDescription>Daily log returns: ln(Pₜ / Pₜ₋₁)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div ref={returnsChartRef} className="w-full" style={{ height: "300px" }} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stationarity" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Augmented Dickey-Fuller (ADF) Test</CardTitle>
                      <CardDescription>
                        Tests for stationarity. Null hypothesis: series has a unit root (non-stationary)
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
                                <Badge className="bg-green-100 text-green-800">Stationary</Badge>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-5 w-5 text-red-500" />
                                <Badge className="bg-red-100 text-red-800">Non-Stationary</Badge>
                              </>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Test Statistic</p>
                              <p className="text-lg font-bold">{adfResult.testStatistic.toFixed(4)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">P-Value</p>
                              <p className="text-lg font-bold">
                                {adfResult.pValue === 0 || adfResult.pValue < 0.0001 
                                  ? "< 0.0001" 
                                  : adfResult.pValue.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold mb-2">Critical Values</p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-sm">1%:</span>
                                <span className="text-sm font-mono">{adfResult.criticalValues["1%"].toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm">5%:</span>
                                <span className="text-sm font-mono">{adfResult.criticalValues["5%"].toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm">10%:</span>
                                <span className="text-sm font-mono">{adfResult.criticalValues["10%"].toFixed(4)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm font-semibold mb-1">Interpretation:</p>
                            <p className="text-sm">{adfResult.interpretation}</p>
                            <p className="text-sm mt-2 font-semibold">Recommendation:</p>
                            <p className="text-sm">{adfResult.recommendation}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Click to run ADF test</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="acf-pacf" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>ACF (Autocorrelation Function)</CardTitle>
                      <CardDescription>
                        Measures correlation between returns and lagged returns
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingACF ? (
                        <Skeleton className="h-64 w-full" />
                      ) : acfPacfData && acfPacfData.lags && acfPacfData.acf ? (
                        <div ref={acfChartRef} className="w-full" style={{ height: "300px" }} />
                      ) : (
                        <p className="text-sm text-gray-500">
                          {selectedSymbol ? "No ACF data available. Try selecting a different timeframe or symbol." : "Select a stock to view ACF data"}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>PACF (Partial Autocorrelation Function)</CardTitle>
                      <CardDescription>
                        Measures direct correlation after removing indirect effects
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingACF ? (
                        <Skeleton className="h-64 w-full" />
                      ) : acfPacfData && acfPacfData.lags && acfPacfData.pacf ? (
                        <div ref={pacfChartRef} className="w-full" style={{ height: "300px", minHeight: "300px" }} />
                      ) : (
                        <p className="text-sm text-gray-500">
                          {selectedSymbol ? "No PACF data available. Try selecting a different timeframe or symbol." : "Select a stock to view PACF data"}
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
                        Autoregressive (AR), Moving Average (MA), and ARIMA models for time-series forecasting
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">AR order (p)</label>
                          <input type="number" min="0" max="5" defaultValue="1" className="w-full px-2 py-1 border rounded text-sm" id="ar-order" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">Differencing (d)</label>
                          <input type="number" min="0" max="2" defaultValue="0" className="w-full px-2 py-1 border rounded text-sm" id="diff-order" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">MA order (q)</label>
                          <input type="number" min="0" max="5" defaultValue="1" className="w-full px-2 py-1 border rounded text-sm" id="ma-order" />
                        </div>
                      </div>
                      <Button 
                        onClick={async () => {
                          const p = parseInt((document.getElementById('ar-order') as HTMLInputElement)?.value || '1');
                          const d = parseInt((document.getElementById('diff-order') as HTMLInputElement)?.value || '0');
                          const q = parseInt((document.getElementById('ma-order') as HTMLInputElement)?.value || '1');
                          setLoadingARIMA(true);
                          setArimaResult(null);
                          try {
                            // Use longer timeframe for ARIMA if current timeframe is too short
                            const arimaTimeframe = timeframe === '1M' ? '1Y' : timeframe;
                            const resp = await fetch('/api/dsfm/arima', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ symbol: selectedSymbol, timeframe: arimaTimeframe, order: [p, d, q] }),
                            });
                            if (resp.ok) {
                              const data = await resp.json();
                              setArimaResult(data);
                              console.log('ARIMA Model Results:', data);
                            } else {
                              const errorData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
                              const errorMsg = errorData.error || errorData.message || 'Unknown error';
                              if (errorMsg.includes('ml_service_unavailable')) {
                                alert(`ARIMA Model Error: ML service is not running.\n\nPlease start the ML service:\n1. Open a new terminal\n2. cd ml-service\n3. python app.py\n\nThe service should run on port 8000.`);
                              } else {
                                alert(`ARIMA Model Error: ${errorMsg}`);
                              }
                            }
                          } catch (e: any) {
                            console.error('ARIMA model error:', e);
                            alert(`ARIMA Model Error: ${e.message || 'Network error'}`);
                          } finally {
                            setLoadingARIMA(false);
                          }
                        }}
                        disabled={loadingARIMA}
                      >
                        {loadingARIMA ? 'Fitting Model...' : 'Fit ARIMA Model'}
                      </Button>
                      {arimaResult && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-2">
                          <p className="font-semibold text-green-800 dark:text-green-200">ARIMA Model Results</p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">AIC:</span>
                              <span className="ml-2 font-mono font-bold">{arimaResult.aic?.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">BIC:</span>
                              <span className="ml-2 font-mono font-bold">{arimaResult.bic?.toFixed(2)}</span>
                            </div>
                          </div>
                          {arimaResult.forecast && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400">5-Step Forecast:</p>
                              <p className="text-xs font-mono">{arimaResult.forecast.map((f: number) => f.toFixed(4)).join(', ')}</p>
                              <div ref={arimaChartRef} className="w-full mt-2" style={{ height: "240px" }} />
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        ARIMA(p,d,q): p=autoregressive terms, d=differencing, q=moving average terms. 
                        Note: Using 1Y timeframe for ARIMA models to ensure sufficient data (minimum 30 candles required).
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>ARCH/GARCH Models</CardTitle>
                      <CardDescription>
                        Autoregressive Conditional Heteroskedasticity models for volatility clustering
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">GARCH p (ARCH terms)</label>
                          <input type="number" min="1" max="3" defaultValue="1" className="w-full px-2 py-1 border rounded text-sm" id="garch-p" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">GARCH q (GARCH terms)</label>
                          <input type="number" min="1" max="3" defaultValue="1" className="w-full px-2 py-1 border rounded text-sm" id="garch-q" />
                        </div>
                      </div>
                      <Button 
                        onClick={async () => {
                          const p = parseInt((document.getElementById('garch-p') as HTMLInputElement)?.value || '1');
                          const q = parseInt((document.getElementById('garch-q') as HTMLInputElement)?.value || '1');
                          setLoadingGARCH(true);
                          setGarchResult(null);
                          try {
                            // Use longer timeframe for GARCH if current timeframe is too short
                            const garchTimeframe = timeframe === '1M' ? '1Y' : timeframe;
                            const resp = await fetch('/api/dsfm/garch', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ symbol: selectedSymbol, timeframe: garchTimeframe, order: [p, q] }),
                            });
                            if (resp.ok) {
                              const data = await resp.json();
                              setGarchResult(data);
                              console.log('GARCH Model Results:', data);
                            } else {
                              const errorData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
                              const errorMsg = errorData.error || errorData.message || 'Unknown error';
                              if (errorMsg.includes('ml_service_unavailable')) {
                                alert(`GARCH Model Error: ML service is not running.\n\nPlease start the ML service:\n1. Open a new terminal\n2. cd ml-service\n3. python app.py\n\nThe service should run on port 8000.`);
                              } else {
                                alert(`GARCH Model Error: ${errorMsg}`);
                              }
                            }
                          } catch (e: any) {
                            console.error('GARCH model error:', e);
                            alert(`GARCH Model Error: ${e.message || 'Network error'}`);
                          } finally {
                            setLoadingGARCH(false);
                          }
                        }}
                        disabled={loadingGARCH}
                      >
                        {loadingGARCH ? 'Fitting Model...' : 'Fit GARCH Model'}
                      </Button>
                      {garchResult && (
                        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg space-y-2">
                          <p className="font-semibold text-purple-800 dark:text-purple-200">GARCH Model Results</p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">AIC:</span>
                              <span className="ml-2 font-mono font-bold">{garchResult.aic?.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">BIC:</span>
                              <span className="ml-2 font-mono font-bold">{garchResult.bic?.toFixed(2)}</span>
                            </div>
                          </div>
                          {garchResult.forecast && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400">Volatility Forecast (5 steps):</p>
                              <p className="text-xs font-mono">{garchResult.forecast.map((f: number) => f.toFixed(4)).join(', ')}</p>
                              <div ref={garchVolChartRef} className="w-full mt-2" style={{ height: "240px" }} />
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        GARCH(p,q): Models volatility clustering. p=ARCH terms, q=GARCH terms.
                        Note: Using 1Y timeframe for GARCH models to ensure sufficient data (minimum 50 candles required).
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : !loading ? (
            <div className="text-center py-8">
              {error ? (
                <div className="space-y-2">
                  <p className="text-red-600 dark:text-red-400 font-semibold">Error loading data</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
                  {error.includes("port 5000") || error.includes("Network error") ? (
                    <p className="text-xs text-gray-500 mt-2">
                      Make sure the backend server is running on port 5000
                    </p>
                  ) : null}
                </div>
              ) : selectedSymbol ? (
                <p className="text-gray-500">No data available for {selectedSymbol}</p>
              ) : (
                <p className="text-gray-500">Select a stock to view returns analysis</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
