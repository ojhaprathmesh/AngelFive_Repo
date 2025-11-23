"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  CandlestickSeries,
  AreaSeries,
  ColorType,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { marketDataService } from "@/lib/market-data";
import {
  Sun,
  Moon,
  Activity,
  BarChart3,
  ChevronDown,
  Undo2,
  Redo2,
  Crosshair,
  MousePointer2,
  Brush,
  Highlighter,
  Ruler,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  LineChart,
  Sigma,
  Move,
} from "lucide-react";

type ChartKind = "Area" | "Candles";
type SizeKey = "1m" | "5m" | "15m" | "1h" | "2h" | "3h" | "4h" | "1d" | "1wk" | "1month";
type IndicatorKey = "EMA" | "SMA" | "RSI";
type ToolKey =
  | "pointer-cross"
  | "pointer-dot"
  | "trendline"
  | "ray"
  | "info"
  | "abcd"
  | "xabcd"
  | "brush"
  | "highlighter"
  | "measure";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartComponentProps {
  symbol?: string;
}

export default function ChartComponent({ symbol = "YESBANK-EQ" }: ChartComponentProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area" | "Candlestick"> | null>(null);
  const indicatorRefs = useRef<Record<string, ISeriesApi<"Line"> | null>>({});
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [dark, setDark] = useState<boolean>(false);
  const [kind, setKind] = useState<ChartKind>("Candles");
  const [size, setSize] = useState<SizeKey>("1d");
  const [indicator, setIndicator] = useState<IndicatorKey | null>(null);
  const [indicatorCfg, setIndicatorCfg] = useState<{ EMA: number; SMA: number; RSI: number }>(
    { EMA: 9, SMA: 20, RSI: 14 }
  );
  const [tool, setTool] = useState<ToolKey>("pointer-cross");
  const [locked, setLocked] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(true);
  const [lastZoom, setLastZoom] = useState<"in" | "out">("in");
  const pointerGroup: ToolKey[] = ["pointer-cross", "pointer-dot"];
  const lineGroup: ToolKey[] = ["trendline", "ray", "info"];
  const patternGroup: ToolKey[] = ["xabcd", "abcd"];
  const paintGroup: ToolKey[] = ["brush", "highlighter"];
  const isGroupSelected = (group: ToolKey[]) => group.includes(tool);
  const pointerIcon = () => (tool === "pointer-dot" ? <MousePointer2 className="h-4 w-4"/> : <Crosshair className="h-4 w-4"/>);
  const IconTrend = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={`h-4 w-4 ${props.className || ""}`}> 
      <circle cx="5" cy="16" r="1.5" fill="currentColor" />
      <circle cx="19" cy="8" r="1.5" fill="currentColor" />
      <path d="M6.5 14.5 L17.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconRay = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={`h-4 w-4 ${props.className || ""}`}> 
      <circle cx="5" cy="16" r="1.5" fill="currentColor" />
      <path d="M6.5 15.5 L21 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconInfoLine = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={`h-4 w-4 ${props.className || ""}`}> 
      <circle cx="5" cy="16" r="1.5" fill="currentColor" />
      <path d="M6.5 15.5 L19 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="10.5" y="11.5" width="4" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
  const IconPatternXABCD = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={`h-4 w-4 ${props.className || ""}`}> 
      <circle cx="4.5" cy="15.5" r="1.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="12.5" cy="13.5" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="6.5" r="1.5" fill="currentColor" />
      <circle cx="20.5" cy="14.5" r="1.5" fill="currentColor" />
      <path d="M4.5 15.5 L8.5 7.5 L12.5 13.5 L16.5 6.5 L20.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 15.5 L12.5 13.5 M8.5 7.5 L20.5 14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  const IconPatternABCD = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={`h-4 w-4 ${props.className || ""}`}> 
      <circle cx="6" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="18" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="6" cy="16.5" r="1.5" fill="currentColor" />
      <circle cx="18" cy="16.5" r="1.5" fill="currentColor" />
      <path d="M6 7.5 L18 7.5 L18 16.5 L6 16.5 Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 7.5 L18 16.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
  const lineIcon = () => (tool === "ray" ? <IconRay /> : tool === "info" ? <IconInfoLine /> : <IconTrend />);
  const patternIcon = () => (tool === "abcd" ? <IconPatternABCD /> : <IconPatternXABCD />);
  const paintIcon = () => (tool === "highlighter" ? <Highlighter className="h-4 w-4"/> : <Brush className="h-4 w-4"/>);

  const [data, setData] = useState<Candle[]>([]);
  interface DrawPoint { x: number; y: number }
  type DrawAction =
    | { type: "trendline"; p1: DrawPoint; p2: DrawPoint }
    | { type: "ray"; p1: DrawPoint; p2: DrawPoint }
    | { type: "info"; p1: DrawPoint; p2: DrawPoint }
    | { type: "xabcd"; p1: DrawPoint; p2: DrawPoint }
    | { type: "brush"; path: DrawPoint[]; size?: number }
    | { type: "highlighter"; path: DrawPoint[]; size?: number }
    | { type: "measure"; p1: DrawPoint; p2: DrawPoint };
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redos, setRedos] = useState<DrawAction[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("chartTheme");
    setDark(savedTheme === "dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("chartTheme", dark ? "dark" : "light");
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#e5e7eb" : "#111827",
      },
      grid: {
        horzLines: { color: dark ? "#1f2937" : "#e5e7eb" },
        vertLines: { color: dark ? "#1f2937" : "#e5e7eb" },
      },
    });
  }, [dark]);

  useEffect(() => {
    if (!rootRef.current) return;
    const chart = createChart(rootRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: dark ? "#e5e7eb" : "#111827" },
      rightPriceScale: { borderColor: dark ? "#374151" : "#e5e7eb" },
      timeScale: { borderColor: dark ? "#374151" : "#e5e7eb" },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;
    const s = kind === "Area" ? chart.addSeries(AreaSeries, {}) : chart.addSeries(CandlestickSeries, {});
    seriesRef.current = s;
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.right = "0";
    canvas.style.bottom = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "auto";
    rootRef.current.appendChild(canvas);
    overlayRef.current = canvas;
    const resize = () => {
      const el = rootRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      canvas.width = Math.max(1, Math.floor(w));
      canvas.height = Math.max(1, Math.floor(h));
      if (chartRef.current) chartRef.current.resize(canvas.width, canvas.height);
      drawOverlay();
    };
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(onResize);
      if (rootRef.current) ro.observe(rootRef.current);
    } catch {}
    return () => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
      chart.remove();
      chartRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    seriesRef.current?.priceScale()?.applyOptions({});
    const prev = seriesRef.current;
    if (prev) chart.removeSeries(prev);
    const s = kind === "Area" ? chart.addSeries(AreaSeries, {}) : chart.addSeries(CandlestickSeries, {});
    seriesRef.current = s;
    applySeriesData();
  }, [kind]);

  const fetchCandles = async () => {
    try {
      const now = new Date();
      const toDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      // Use symbol prop if provided, otherwise default to YESBANK-EQ
      const symbolToUse = symbol || "YESBANK-EQ";
      // Format symbol: 
      // - If it has colon (NSE:TCS), use as is
      // - If it has -EQ suffix, use as is
      // - Otherwise, add -EQ for NSE stocks
      let formattedSymbol = symbolToUse;
      if (!symbolToUse.includes(":") && !symbolToUse.includes("-")) {
        formattedSymbol = `${symbolToUse}-EQ`;
      }
      console.log("[ChartComponent] Fetching candles for symbol:", formattedSymbol);
      const tokenInfo = await marketDataService.getSymbolToken(formattedSymbol);
      if (!tokenInfo) {
        console.warn("[ChartComponent] Token info not found for symbol:", formattedSymbol);
        return [] as Candle[];
      }
      console.log("[ChartComponent] Token info:", tokenInfo);
    let baseInterval = "ONE_DAY";
    if (size === "1m") baseInterval = "ONE_MINUTE";
    if (size === "5m") baseInterval = "FIVE_MINUTE";
    if (size === "15m") baseInterval = "FIFTEEN_MINUTE";
    if (size === "1h" || size === "2h" || size === "3h" || size === "4h") baseInterval = "ONE_HOUR";
    if (size === "1d" || size === "1wk" || size === "1month") baseInterval = "ONE_DAY";
    const from = new Date();
    if (size === "1m" || size === "5m" || size === "15m") from.setDate(from.getDate() - 5);
    else if (size === "1h" || size === "2h" || size === "3h" || size === "4h") from.setMonth(from.getMonth() - 1);
    else if (size === "1d") from.setFullYear(from.getFullYear() - 1);
    else if (size === "1wk" || size === "1month") from.setFullYear(from.getFullYear() - 5);
      const fromDate = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")} ${String(from.getHours()).padStart(2, "0")}:${String(from.getMinutes()).padStart(2, "0")}`;
      console.log("[ChartComponent] Fetching candle data:", { exchange: tokenInfo.exchange, token: tokenInfo.token, interval: baseInterval, fromDate, toDate });
      const raw = await marketDataService.getCandleData(tokenInfo.exchange, tokenInfo.token, baseInterval, fromDate, toDate);
      console.log("[ChartComponent] Received", raw.length, "candles");
      const base = raw.map((c) => ({ time: Math.floor(new Date(c[0]).getTime() / 1000), open: c[1], high: c[2], low: c[3], close: c[4] }));
    if (size === "2h" || size === "3h" || size === "4h") {
      const group = size === "2h" ? 2 : size === "3h" ? 3 : 4;
      return aggregate(base, group * 3600);
    }
      if (size === "1wk") return aggregate(base, 7 * 24 * 3600);
      if (size === "1month") return aggregateMonthly(base);
      console.log("[ChartComponent] Returning", base.length, "processed candles");
      return base;
    } catch (error) {
      console.error("[ChartComponent] Error fetching candles:", error);
      return [] as Candle[];
    }
  };

  const aggregate = (candles: Candle[], secs: number): Candle[] => {
    const out: Candle[] = [];
    let bucket: Candle | null = null;
    let start = 0;
    for (const c of candles) {
      if (!bucket) {
        bucket = { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
        start = c.time;
      } else {
        bucket.high = Math.max(bucket.high, c.high);
        bucket.low = Math.min(bucket.low, c.low);
        bucket.close = c.close;
      }
      if (c.time - start >= secs && bucket) {
        out.push(bucket);
        bucket = null;
      }
    }
    if (bucket) out.push(bucket);
    return out;
  };

  const aggregateMonthly = (candles: Candle[]): Candle[] => {
    const out: Candle[] = [];
    let bucket: Candle | null = null;
    let currentMonth = -1;
    for (const c of candles) {
      const d = new Date(c.time * 1000);
      const m = d.getUTCFullYear() * 12 + d.getUTCMonth();
      if (m !== currentMonth) {
        if (bucket) out.push(bucket);
        bucket = { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
        currentMonth = m;
      } else {
        if (bucket) {
          bucket.high = Math.max(bucket.high, c.high);
          bucket.low = Math.min(bucket.low, c.low);
          bucket.close = c.close;
        }
      }
    }
    if (bucket) out.push(bucket);
    return out;
  };

  const applySeriesData = async () => {
    console.log("[ChartComponent] applySeriesData called, symbol:", symbol, "size:", size);
    const candles = await fetchCandles();
    console.log("[ChartComponent] Got", candles.length, "candles");
    setData(candles);
    if (!seriesRef.current) {
      console.warn("[ChartComponent] Series ref is null, cannot set data");
      return;
    }
    if (candles.length === 0) {
      console.warn("[ChartComponent] No candles to display");
      return;
    }
    try {
      if (kind === "Area") {
        seriesRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
      } else {
        seriesRef.current.setData(
          candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }))
        );
      }
      chartRef.current?.timeScale().fitContent();
      drawOverlay();
      computeIndicators();
      console.log("[ChartComponent] Chart data applied successfully");
    } catch (error) {
      console.error("[ChartComponent] Error applying series data:", error);
    }
  };

  useEffect(() => {
    applySeriesData();
  }, [size, symbol]);

  useEffect(() => {
    computeIndicators();
  }, [indicator, indicatorCfg, data]);

  const sma = (period: number) => {
    const vals = data.map((d) => d.close);
    const res: { time: number; value: number }[] = [];
    for (let i = period - 1; i < vals.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += vals[i - j];
      res.push({ time: data[i].time, value: sum / period });
    }
    return res;
  };

  const ema = (period: number) => {
    const vals = data.map((d) => d.close);
    const res: { time: number; value: number }[] = [];
    const k = 2 / (period + 1);
    let prev = vals[0];
    for (let i = 0; i < vals.length; i++) {
      const e = vals[i] * k + prev * (1 - k);
      prev = e;
      res.push({ time: data[i].time, value: e });
    }
    return res.slice(period - 1);
  };

  const rsi = (period: number) => {
    const res: { time: number; value: number }[] = [];
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const avgGain = (gains + Math.max(diff, 0)) / period;
      const avgLoss = (losses + Math.max(-diff, 0)) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const value = 100 - 100 / (1 + rs);
      res.push({ time: data[i].time, value });
      gains = avgGain * period;
      losses = avgLoss * period;
    }
    return res;
  };

  const computeIndicators = () => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    Object.keys(indicatorRefs.current).forEach((k) => {
      const ref = indicatorRefs.current[k];
      if (ref) chart.removeSeries(ref);
      indicatorRefs.current[k] = null;
    });
    if (!indicator) return;
    const cfg = indicatorCfg[indicator];
    let points: { time: number; value: number }[] = [];
    if (indicator === "SMA") points = sma(cfg);
    if (indicator === "EMA") points = ema(cfg);
    if (indicator === "RSI") points = rsi(cfg);
    const s = chart.addSeries(LineSeries, { color: indicator === "RSI" ? "#f59e0b" : "#22c55e", lineWidth: 2 });
    indicatorRefs.current[indicator] = s;
    s.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
  };

  const drawOverlay = () => {
    if (!overlayRef.current) return;
    const ctx = overlayRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    if (!visible) return;
    actions.forEach((a: DrawAction) => {
      if (a.type === "trendline") {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.p1.x, a.p1.y);
        ctx.lineTo(a.p2.x, a.p2.y);
        ctx.stroke();
      } else if (a.type === "ray") {
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.p1.x, a.p1.y);
        ctx.lineTo(a.p2.x, a.p2.y);
        ctx.stroke();
      } else if (a.type === "brush") {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = a.size || 2;
        ctx.beginPath();
        a.path.forEach((p: { x: number; y: number }, i: number) => {
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      } else if (a.type === "highlighter") {
        ctx.strokeStyle = "rgba(59,130,246,0.4)";
        ctx.lineWidth = a.size || 8;
        ctx.beginPath();
        a.path.forEach((p: { x: number; y: number }, i: number) => {
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      } else if (a.type === "xabcd") {
        const top = Math.min(a.p1.y, a.p2.y);
        const bottom = Math.max(a.p1.y, a.p2.y);
        ctx.strokeStyle = "#10b981";
        ctx.beginPath();
        ctx.moveTo(a.p1.x, top);
        ctx.lineTo(a.p2.x, top);
        ctx.moveTo(a.p1.x, bottom);
        ctx.lineTo(a.p2.x, bottom);
        ctx.stroke();
      } else if (a.type === "measure") {
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.p1.x, a.p1.y);
        ctx.lineTo(a.p2.x, a.p2.y);
        ctx.stroke();
      }
    });
  };

  useEffect(() => {
    drawOverlay();
  }, [actions, visible]);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    let drawing = false;
    let current: DrawAction | null = null;
    const getPos = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };
    const down = (e: MouseEvent) => {
      if (locked) return;
      const p = getPos(e);
      if (tool === "trendline" || tool === "ray" || tool === "measure" || tool === "info") {
        drawing = true;
        current = tool === "info" ? { type: "info", p1: p, p2: p } : { type: tool as "trendline"|"ray"|"measure", p1: p, p2: p };
      } else if (tool === "brush" || tool === "highlighter") {
        drawing = true;
        current = { type: tool as "brush"|"highlighter", path: [p], size: tool === "brush" ? 2 : 8 };
      }
    };
    const move = (e: MouseEvent) => {
      if (!drawing || !current) return;
      const p = getPos(e);
      if (current.type === "brush" || current.type === "highlighter") {
        current.path.push(p);
      } else {
        current.p2 = p;
      }
      drawOverlay();
    };
    const up = () => {
      if (!drawing || !current) return;
      setActions((prev) => [...prev, current as DrawAction]);
      setRedos([]);
      drawing = false;
      current = null;
    };
    canvas.addEventListener("mousedown", down);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      canvas.removeEventListener("mousedown", down);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [tool, locked]);

  const undo = () => {
    if (actions.length === 0) return;
    const next = actions.slice(0, -1);
    const last = actions[actions.length - 1];
    setActions(next);
    setRedos((r) => [...r, last]);
  };

  const redo = () => {
    if (redos.length === 0) return;
    const last = redos[redos.length - 1];
    setRedos(redos.slice(0, -1));
    setActions((a) => [...a, last]);
  };

  const doFit = () => {
    chartRef.current?.timeScale().fitContent();
  };

  const doZoomIn = () => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const width = range.to - range.from;
    const delta = width * 0.1;
    ts.setVisibleLogicalRange({ from: range.from + delta, to: range.to - delta });
    setLastZoom("in");
  };

  const doZoomOut = () => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const width = range.to - range.from;
    const delta = width * 0.1;
    ts.setVisibleLogicalRange({ from: range.from - delta, to: range.to + delta });
    setLastZoom("out");
  };

  return (
    <div className={dark ? "dark h-full" : "h-full"}>
      <div className="flex flex-col h-full gap-3">
        <div className="flex items-center justify-between border-b pb-2" role="toolbar" aria-label="Chart controls">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDark((v) => !v)} aria-label="Toggle theme" title="Theme">
              {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-haspopup="menu" title="Candle size" className="flex items-center gap-1">
                  <span>{size.toUpperCase()}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <div className="px-2 py-1 text-[11px]">Minutes</div>
                {(["1m","5m","15m"] as SizeKey[]).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => setSize(s)} aria-selected={size===s}>{s.toUpperCase()}</DropdownMenuItem>
                ))}
                <div className="px-2 py-1 text-[11px]">Hours</div>
                {(["1h","2h","3h","4h"] as SizeKey[]).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => setSize(s)} aria-selected={size===s}>{s.toUpperCase()}</DropdownMenuItem>
                ))}
                <div className="px-2 py-1 text-[11px]">Days/Weeks/Months</div>
                {(["1d","1wk","1month"] as SizeKey[]).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => setSize(s)} aria-selected={size===s}>{s.toUpperCase()}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={() => setKind((p)=>p==="Area"?"Candles":"Area")} aria-label="Toggle style" title="Style">
              {kind === "Area" ? <Activity className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1" title="Indicators">
                  <LineChart className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {(["EMA","SMA","RSI"] as IndicatorKey[]).map((k) => (
                  <DropdownMenuItem key={k} onClick={() => setIndicator(k)} aria-selected={indicator===k}>{k}</DropdownMenuItem>
                ))}
                <div className="px-2 py-1 text-[11px]">Config</div>
                <DropdownMenuItem onClick={() => setIndicatorCfg((c)=>({ ...c, EMA: Math.max(2,c.EMA-1) }))}>EMA -</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIndicatorCfg((c)=>({ ...c, EMA: c.EMA+1 }))}>EMA +</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIndicatorCfg((c)=>({ ...c, SMA: Math.max(2,c.SMA-1) }))}>SMA -</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIndicatorCfg((c)=>({ ...c, SMA: c.SMA+1 }))}>SMA +</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIndicatorCfg((c)=>({ ...c, RSI: Math.max(2,c.RSI-1) }))}>RSI -</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIndicatorCfg((c)=>({ ...c, RSI: c.RSI+1 }))}>RSI +</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={undo} disabled={actions.length===0} title="Undo" aria-disabled={actions.length===0}><Undo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={redos.length===0} title="Redo" aria-disabled={redos.length===0}><Redo2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col items-center gap-2 pr-2 border-r" role="toolbar" aria-label="Left tools">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={isGroupSelected(pointerGroup)?"default":"ghost"} size="icon-sm" className="relative" aria-label="Pointer tools" title="Pointer tools">
                  {pointerIcon()}
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right">
                <DropdownMenuLabel>Pointer</DropdownMenuLabel>
                <DropdownMenuItem onClick={()=>setTool("pointer-cross")}><Crosshair className="h-4 w-4"/> Cross</DropdownMenuItem>
                <DropdownMenuItem onClick={()=>setTool("pointer-dot")}><MousePointer2 className="h-4 w-4"/> Dot</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={isGroupSelected(lineGroup)?"default":"ghost"} size="icon-sm" className="relative" aria-label="Line tools" title="Line tools">
                  {lineIcon()}
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right">
                <DropdownMenuLabel>Lines</DropdownMenuLabel>
                <DropdownMenuItem onClick={()=>setTool("trendline")}><IconTrend /> Trendline</DropdownMenuItem>
                <DropdownMenuItem onClick={()=>setTool("ray")}><IconRay /> Ray</DropdownMenuItem>
                <DropdownMenuItem onClick={()=>setTool("info")}><IconInfoLine /> Infoline</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={isGroupSelected(patternGroup)?"default":"ghost"} size="icon-sm" className="relative" aria-label="Pattern tools" title="Pattern tools">
                  {patternIcon()}
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right">
                <DropdownMenuLabel>Patterns</DropdownMenuLabel>
                <DropdownMenuItem onClick={()=>setTool("xabcd")}><IconPatternXABCD /> XABCD</DropdownMenuItem>
                <DropdownMenuItem onClick={()=>setTool("abcd")}><IconPatternABCD /> ABCD</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={isGroupSelected(paintGroup)?"default":"ghost"} size="icon-sm" className="relative" aria-label="Paint tools" title="Paint tools">
                  {paintIcon()}
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right">
                <DropdownMenuLabel>Paint</DropdownMenuLabel>
                <DropdownMenuItem onClick={()=>setTool("brush")}><Brush className="h-4 w-4"/> Brush</DropdownMenuItem>
                <DropdownMenuItem onClick={()=>setTool("highlighter")}><Highlighter className="h-4 w-4"/> Highlighter</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant={tool==="measure"?"default":"ghost"} size="icon-sm" onClick={()=>setTool("measure")} title="Measure" aria-label="Measure"><Ruler className="h-4 w-4"/></Button>
            <div className="h-px w-full bg-gray-200 dark:bg-gray-700" />
            <Button
              variant={locked?"default":"ghost"}
              size="icon-sm"
              onClick={()=>setLocked((v)=>!v)}
              title={locked?"Unlock":"Lock"}
              aria-label={locked?"Unlock":"Lock"}
            >
              {locked ? <Unlock className="h-4 w-4"/> : <Lock className="h-4 w-4"/>}
            </Button>
            <Button variant={visible?"default":"ghost"} size="icon-sm" onClick={()=>setVisible((v)=>!v)} title="Show/Hide">{visible?<Eye className="h-4 w-4"/>:<EyeOff className="h-4 w-4"/>}</Button>
            <Button variant="ghost" size="icon-sm" onClick={()=>{ if (window.confirm("Delete all drawings?")) { setActions([]); setRedos([]); } }} title="Delete all"><Trash2 className="h-4 w-4"/></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="relative" aria-label="Zoom" title="Zoom">
                  {lastZoom === "out" ? <ZoomOut className="h-4 w-4"/> : <ZoomIn className="h-4 w-4"/>}
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right">
                <DropdownMenuLabel>Zoom</DropdownMenuLabel>
                <DropdownMenuItem onClick={doZoomIn}><ZoomIn className="h-4 w-4"/> Zoom In</DropdownMenuItem>
                <DropdownMenuItem onClick={doZoomOut}><ZoomOut className="h-4 w-4"/> Zoom Out</DropdownMenuItem>
                <DropdownMenuItem onClick={doFit}><ZoomOut className="h-4 w-4"/> Fit</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 relative rounded-md border bg-gray-50 dark:bg-gray-900 overflow-hidden min-h-[400px]">
            <div ref={rootRef} className="absolute inset-0 overflow-hidden" style={{ minHeight: '400px' }} aria-label="Chart" />
          </div>
        </div>
      </div>
    </div>
  );
}