"use client";

import {
    BusinessDay,
    CandlestickSeries,
    ColorType,
    createChart,
    CrosshairMode,
    IChartApi,
    ISeriesApi,
    LineSeries,
    Time,
} from "lightweight-charts";
import { Activity, AlertCircle, Circle, Moon, MousePointer2, Move, Sun, ZoomIn, ZoomOut, } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface WatchlistChartProps {
    symbol: string;
    exchange?: string;
}

export function WatchlistChart({
    symbol,
    exchange = "NSE",
}: WatchlistChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const resizeHandlerRef = useRef<(() => void) | null>(null);
    const toolCleanupRef = useRef<(() => void) | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allChartData, setAllChartData] = useState<any[]>([]);
    const [timeframe, setTimeframe] = useState<
        "1D" | "5D" | "1M" | "3M" | "6M" | "1Y"
    >("1Y");
    const [showEMA, setShowEMA] = useState<boolean>(false);
    const [emaPeriod, setEmaPeriod] = useState<number>(9);
    const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const [darkMode, setDarkMode] = useState<boolean>(false);
    const [toolMode, setToolMode] = useState<"pointer" | "cross" | "dot">(
        "pointer",
    );
    const prevSymbolRef = useRef<string>("");
    const initAttemptedRef = useRef<boolean>(false);

    // Fetch data from Yahoo Finance via backend proxy (avoids CORS)
    const fetchYahooFinanceData = useCallback(
        async (
            symbol: string,
        ): Promise<Array<[string, number, number, number, number, number]>> => {
            // Clean symbol
            let cleanSymbol = symbol.toUpperCase().trim();
            cleanSymbol = cleanSymbol.replace(/-EQ$/, "");
            cleanSymbol = cleanSymbol.replace(/^NSE:/, "");

            console.log(
                "[WatchlistChart] Fetching Yahoo Finance data for:",
                cleanSymbol,
            );

            try {
                const response = await fetch(
                    `/api/market/yahoo-finance?symbol=${encodeURIComponent(cleanSymbol)}&timeframe=${timeframe}`,
                );

                if (!response.ok) {
                    console.error(
                        "[WatchlistChart] Backend Yahoo Finance error:",
                        response.status,
                    );
                    return [];
                }

                const data = await response.json();

                if (data.candles && data.candles.length > 0) {
                    console.log(
                        "[WatchlistChart] ✅ Got",
                        data.candles.length,
                        "candles from backend for",
                        data.symbol,
                    );
                    return data.candles;
                }

                console.warn("[WatchlistChart] No candles in response");
                return [];
            } catch (e: any) {
                console.error(
                    "[WatchlistChart] Error fetching from backend:",
                    e.message,
                );
                return [];
            }
        },
        [],
    );

    // Calculate EMA
    const calculateEMA = useCallback(
        (data: any[], period: number): { time: Time; value: number }[] => {
            if (data.length < period) return [];
            const result: { time: Time; value: number }[] = [];
            const multiplier = 2 / (period + 1);
            let ema =
                data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;

            for (let i = period - 1; i < data.length; i++) {
                if (i === period - 1) {
                    ema =
                        data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
                } else {
                    ema = (data[i].close - ema) * multiplier + ema;
                }
                result.push({ time: data[i].time, value: ema });
            }
            return result;
        },
        [],
    );

    // Update EMA indicator
    const updateEMA = useCallback(
        (data: any[]) => {
            if (!chartRef.current || !showEMA) return;

            if (emaSeriesRef.current) {
                chartRef.current.removeSeries(emaSeriesRef.current);
                emaSeriesRef.current = null;
            }

            const emaData = calculateEMA(data, emaPeriod);
            if (emaData.length > 0 && chartRef.current) {
                const emaSeries = chartRef.current.addSeries(LineSeries, {
                    color: "#3b82f6",
                    lineWidth: 2,
                    title: `EMA ${emaPeriod}`,
                });
                emaSeries.setData(emaData);
                emaSeriesRef.current = emaSeries;
            }
        },
        [showEMA, emaPeriod, calculateEMA],
    );

    // Format symbol for API
    const formatSymbol = (sym: string, exch: string) => {
        let cleanSymbol = sym;
        if (sym.includes(":")) {
            cleanSymbol = sym.split(":")[1];
        }
        if (cleanSymbol.includes("-")) {
            return cleanSymbol;
        }
        if (exch === "NSE") {
            return `${cleanSymbol}-EQ`;
        }
        return `${cleanSymbol}-EQ`;
    };

    // Initialize chart - simplified and reliable
    const initializeChart = useCallback(() => {
        if (!chartContainerRef.current || chartRef.current) {
            console.warn(
                "[WatchlistChart] Cannot initialize - container:",
                !!chartContainerRef.current,
                "chart:",
                !!chartRef.current,
            );
            return false;
        }

        // Force minimum dimensions if container is too small
        let width = chartContainerRef.current.clientWidth;
        let height = chartContainerRef.current.clientHeight;

        if (width === 0 || width < 100) {
            width = 800;
            console.log("[WatchlistChart] Using default width:", width);
        }
        if (height === 0 || height < 100) {
            height = 400; // Default height if container is not ready
            console.log("[WatchlistChart] Using default height:", height);
        }

        // Reserve space for X-axis
        // height = Math.max(height, 600); // Removed fixed minimum height to allow fitting in container

        console.log(
            "[WatchlistChart] Initializing with dimensions:",
            width,
            "x",
            height,
        );

        try {
            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: {
                        type: ColorType.Solid,
                        color: darkMode ? "#1f2937" : "transparent",
                    },
                    textColor: darkMode ? "#e5e7eb" : "#374151",
                },
                width: width,
                height: height,
                grid: {
                    vertLines: { color: "transparent" },
                    horzLines: { color: darkMode ? "#374151" : "#e5e7eb" },
                },
                crosshair: {
                    mode: 1,
                },
                rightPriceScale: {
                    borderColor: darkMode ? "#374151" : "#e5e7eb",
                    visible: true,
                },
                timeScale: {
                    borderVisible: true,
                    timeVisible: true,
                    visible: true,
                    rightOffset: 12,
                    barSpacing: 6,
                    fixLeftEdge: false,
                    fixRightEdge: false,
                    lockVisibleTimeRangeOnResize: false,
                    rightBarStaysOnScroll: true,
                    allowBoldLabels: true,
                    shiftVisibleRangeOnNewBar: true,
                    minimumHeight: 80,
                    tickMarkFormatter: (time: Time) => {
                        try {
                            let date: Date;
                            if (typeof time === "number") {
                                date = new Date(time * 1000);
                            } else {
                                const bd = time as BusinessDay;
                                date = new Date(bd.year, bd.month - 1, bd.day);
                            }
                            const month = date.toLocaleDateString("en-US", {
                                month: "short",
                            });
                            const day = date.getDate();
                            const year = date.getFullYear();
                            return `${day} ${month} ${year}`;
                        } catch (e) {
                            return "";
                        }
                    },
                },
                handleScroll: {
                    mouseWheel: true,
                    pressedMouseMove: true,
                },
                handleScale: {
                    axisPressedMouseMove: true,
                    mouseWheel: true,
                    pinch: true,
                },
            });

            const candlestickSeries = chart.addSeries(CandlestickSeries, {
                upColor: "#22c55e",
                downColor: "#ef4444",
                borderUpColor: "#22c55e",
                borderDownColor: "#ef4444",
                wickUpColor: "#22c55e",
                wickDownColor: "#ef4444",
            });

            chartRef.current = chart;
            seriesRef.current = candlestickSeries;

            const handleResize = (entries: ResizeObserverEntry[]) => {
                if (!chartRef.current || entries.length === 0) return;

                const entry = entries[0];
                const { width, height } = entry.contentRect;

                // Ensure we have valid dimensions
                if (width === 0 || height === 0) return;

                console.log("[WatchlistChart] Resizing to:", width, "x", height);
                chartRef.current.applyOptions({ width, height });
                chartRef.current.timeScale().fitContent();
            };

            const resizeObserver = new ResizeObserver(handleResize);
            resizeObserver.observe(chartContainerRef.current);

            // Store cleanup function
            resizeHandlerRef.current = () => resizeObserver.disconnect();

            console.log("[WatchlistChart] Chart initialized successfully");
            return true;
        } catch (e) {
            console.error("[WatchlistChart] Error initializing chart:", e);
            return false;
        }
    }, [darkMode]);

    // Set chart data
    const setChartData = useCallback(
        (data: any[]) => {
            if (!seriesRef.current || data.length === 0) {
                console.warn(
                    "[WatchlistChart] Cannot set data - series:",
                    !!seriesRef.current,
                    "data length:",
                    data.length,
                );
                return;
            }

            try {
                console.log("[WatchlistChart] Setting", data.length, "candles");

                seriesRef.current.setData(data);
                chartRef.current?.timeScale().fitContent();

                if (showEMA) {
                    updateEMA(data);
                }

                console.log("[WatchlistChart] Data set successfully");
            } catch (e) {
                console.error("[WatchlistChart] Error setting data:", e);
            }
        },
        [showEMA, updateEMA],
    );

    // Main effect: Load data and initialize chart
    useEffect(() => {
        if (!symbol) {
            console.log("[WatchlistChart] No symbol provided");
            return;
        }

        const prevSymbol = prevSymbolRef.current;
        const isSymbolChange = prevSymbol !== symbol && prevSymbol !== "";

        console.log(
            "[WatchlistChart] ⚡ useEffect triggered - symbol:",
            symbol,
            "prevSymbol:",
            prevSymbol,
            "isChange:",
            isSymbolChange,
        );

        // ALWAYS clean up and reset on symbol change
        if (isSymbolChange && prevSymbol) {
            console.log(
                "[WatchlistChart] 🔄 Symbol changed from",
                prevSymbol,
                "to",
                symbol,
                "- FORCING complete cleanup",
            );

            initAttemptedRef.current = false;

            if (chartRef.current) {
                try {
                    if (emaSeriesRef.current) {
                        chartRef.current.removeSeries(emaSeriesRef.current);
                        emaSeriesRef.current = null;
                    }
                    if (resizeHandlerRef.current) {
                        (resizeHandlerRef.current as () => void)();
                        resizeHandlerRef.current = null;
                    }
                    chartRef.current.remove();
                } catch (e) {
                    console.error("[WatchlistChart] Error during cleanup:", e);
                }
            }

            // Force reset all refs
            chartRef.current = null;
            seriesRef.current = null;
            setIsLoading(true);
            setError(null);
            setAllChartData([]);

            console.log("[WatchlistChart] ✅ Cleanup complete, starting fresh load");
        }

        // Update ref AFTER cleanup (so next render can detect change)
        prevSymbolRef.current = symbol;

        const loadChart = async () => {
            try {
                console.log(
                    "[WatchlistChart] ====== STARTING CHART LOAD FOR:",
                    symbol,
                    "======",
                );

                // DIRECTLY use Yahoo Finance - skip ALL token lookups
                console.log(
                    "[WatchlistChart] Fetching from Yahoo Finance directly for:",
                    symbol,
                );
                const candles = await fetchYahooFinanceData(symbol);

                if (!candles || candles.length === 0) {
                    throw new Error(
                        `Unable to fetch chart data for ${symbol} from Yahoo Finance. Please check if the symbol is correct.`,
                    );
                }

                console.log(
                    "[WatchlistChart] ✅ Got",
                    candles.length,
                    "candles from Yahoo Finance",
                );

                // Convert to chart format
                const allData = candles.map((c) => {
                    const date = new Date(c[0]);
                    const time: BusinessDay = {
                        year: date.getFullYear(),
                        month: date.getMonth() + 1,
                        day: date.getDate(),
                    };
                    return {
                        time: time as Time,
                        open: c[1],
                        high: c[2],
                        low: c[3],
                        close: c[4],
                    };
                });

                console.log(
                    "[WatchlistChart] ✅ Converted to chart format:",
                    allData.length,
                    "data points",
                );
                setAllChartData(allData);

                // Initialize chart - wait for container to be ready
                const initChart = () => {
                    if (!chartContainerRef.current) {
                        console.warn("[WatchlistChart] Container not ready, retrying...");
                        setTimeout(initChart, 100);
                        return;
                    }

                    if (!chartRef.current) {
                        console.log("[WatchlistChart] Initializing chart...");
                        const success = initializeChart();
                        if (!success) {
                            console.warn("[WatchlistChart] Chart init failed, retrying...");
                            setTimeout(initChart, 100);
                            return;
                        }
                        console.log("[WatchlistChart] ✅ Chart initialized");
                    }

                    // Set data after chart is ready
                    if (chartRef.current && seriesRef.current && allData.length > 0) {
                        console.log("[WatchlistChart] Setting chart data...");
                        console.log(
                            "[WatchlistChart] Data points:",
                            allData.length,
                            "candles",
                        );

                        try {
                            // CRITICAL: Ensure X-axis is visible BEFORE setting data
                            chartRef.current.timeScale().applyOptions({
                                timeVisible: true,
                                visible: true,
                                rightOffset: 12,
                                minimumHeight: 80,
                                borderVisible: true,
                            });

                            seriesRef.current.setData(allData);
                            chartRef.current.timeScale().fitContent();

                            // CRITICAL: Ensure X-axis is visible AFTER fitContent
                            chartRef.current.timeScale().applyOptions({
                                timeVisible: true,
                                visible: true,
                                rightOffset: 12,
                                minimumHeight: 80, // Increased for better visibility
                                borderVisible: true,
                            });

                            // Fit content after setting timeScale options
                            chartRef.current.timeScale().fitContent();

                            // Force resize to ensure X-axis is rendered
                            setTimeout(() => {
                                if (chartRef.current && chartContainerRef.current) {
                                    const container = chartContainerRef.current;
                                    const newHeight = container.clientHeight || 400;
                                    const newWidth = container.clientWidth || 600;

                                    // Force resize
                                    chartRef.current.applyOptions({
                                        width: newWidth,
                                        height: newHeight,
                                    });

                                    // Re-apply timeScale options to ensure visibility
                                    chartRef.current.timeScale().applyOptions({
                                        timeVisible: true,
                                        visible: true,
                                        minimumHeight: 80,
                                        borderVisible: true,
                                    });

                                    chartRef.current.timeScale().fitContent();
                                    console.log(
                                        "[WatchlistChart] ✅ X-axis configured - height:",
                                        newHeight,
                                    );
                                }
                            }, 100);

                            console.log("[WatchlistChart] ✅ Data set successfully!");

                            if (showEMA) {
                                updateEMA(allData);
                            }

                            setIsLoading(false);
                        } catch (e) {
                            console.error("[WatchlistChart] Error setting data:", e);
                            setIsLoading(false);
                        }
                    } else {
                        console.warn(
                            "[WatchlistChart] Chart or series not ready, retrying...",
                            {
                                chart: !!chartRef.current,
                                series: !!seriesRef.current,
                                dataLength: allData.length,
                            },
                        );
                        setTimeout(initChart, 100);
                    }
                };

                // Start initialization
                setTimeout(initChart, 50);
            } catch (err) {
                console.error("[WatchlistChart] Error:", err);
                setError(err instanceof Error ? err.message : "Failed to load chart");
                setIsLoading(false);
            }
        };

        loadChart();

        return () => {
            console.log(
                "[WatchlistChart] Cleanup function called for symbol:",
                symbol,
            );
            if (resizeHandlerRef.current) {
                (resizeHandlerRef.current as () => void)();
                resizeHandlerRef.current = null;
            }
        };
    }, [
        symbol,
        exchange,
        initializeChart,
        setChartData,
        fetchYahooFinanceData,
        timeframe,
        showEMA,
        updateEMA,
    ]);

    // Trigger full reload when timeframe changes
    useEffect(() => {
        if (!symbol) return;

        // Clear existing data so the main loadChart effect re-runs fresh
        setAllChartData([]);
        setIsLoading(true);
        setError(null);

        if (chartRef.current && seriesRef.current) {
            seriesRef.current.setData([]); // clear visual candles immediately
        }
    }, [timeframe, symbol]);

    // Update EMA when enabled/period changes
    useEffect(() => {
        if (allChartData.length > 0 && chartRef.current && seriesRef.current) {
            if (showEMA) {
                updateEMA(allChartData);
            } else if (emaSeriesRef.current) {
                chartRef.current.removeSeries(emaSeriesRef.current);
                emaSeriesRef.current = null;
            }
        }
    }, [showEMA, emaPeriod, allChartData, updateEMA]);

    // Handle tool mode changes
    useEffect(() => {
        if (!chartRef.current || !chartContainerRef.current) return;

        // Cleanup previous tool
        if (toolCleanupRef.current) {
            toolCleanupRef.current();
            toolCleanupRef.current = null;
        }

        const chart = chartRef.current;
        const container = chartContainerRef.current;

        if (toolMode === "cross") {
            chart.applyOptions({
                crosshair: {
                    mode: CrosshairMode.Normal,
                    vertLine: { visible: true, labelVisible: true },
                    horzLine: { visible: true, labelVisible: true },
                },
            });
            container.style.cursor = "crosshair";
        } else if (toolMode === "dot") {
            chart.applyOptions({
                crosshair: {
                    mode: CrosshairMode.Normal,
                    vertLine: { visible: false, labelVisible: false },
                    horzLine: { visible: false, labelVisible: false },
                },
            });
            container.style.cursor = "none";

            const el = document.createElement("div");
            el.style.position = "absolute";
            el.style.width = "6px";
            el.style.height = "6px";
            el.style.backgroundColor = "#3b82f6";
            el.style.borderRadius = "50%";
            el.style.pointerEvents = "none";
            el.style.zIndex = "50";
            el.style.transform = "translate(-50%, -50%)";
            el.style.display = "none"; // Hide initially
            container.appendChild(el);

            const handleMove = (e: MouseEvent) => {
                const rect = container.getBoundingClientRect();
                el.style.left = `${e.clientX - rect.left}px`;
                el.style.top = `${e.clientY - rect.top}px`;
                el.style.display = "block";
            };

            const handleLeave = () => {
                el.style.display = "none";
            };

            container.addEventListener("mousemove", handleMove);
            container.addEventListener("mouseleave", handleLeave);

            toolCleanupRef.current = () => {
                container.removeEventListener("mousemove", handleMove);
                container.removeEventListener("mouseleave", handleLeave);
                el.remove();
                container.style.cursor = "default";
            };
        } else {
            // Pointer
            chart.applyOptions({
                crosshair: {
                    mode: CrosshairMode.Magnet,
                    vertLine: { visible: false, labelVisible: false },
                    horzLine: { visible: false, labelVisible: false },
                },
            });
            container.style.cursor = "default";
        }
    }, [toolMode, isLoading]); // Re-apply when tool changes or chart re-loads

    // Update dark mode
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.applyOptions({
                layout: {
                    background: {
                        type: ColorType.Solid,
                        color: darkMode ? "#1f2937" : "transparent",
                    },
                    textColor: darkMode ? "#e5e7eb" : "#374151",
                },
                grid: {
                    horzLines: { color: darkMode ? "#374151" : "#e5e7eb" },
                },
                rightPriceScale: {
                    borderColor: darkMode ? "#374151" : "#e5e7eb",
                },
            });
        }
    }, [darkMode]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-row overflow-hidden">
            {/* Simple Vertical Toolbar */}
            <div
                className="flex flex-col items-center gap-2 p-2 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 w-12 shrink-0">
                <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2">
                    Chart
                </div>
                <div className="w-full border-t border-gray-200 dark:border-gray-700 mb-2"></div>

                {/* Pointer Tool */}
                <Button
                    variant={toolMode === "pointer" ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setToolMode("pointer")}
                    title="Pointer (Default Cursor)"
                >
                    <MousePointer2 className="h-4 w-4" />
                </Button>

                {/* Crosshair Tool */}
                <Button
                    variant={toolMode === "cross" ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setToolMode("cross")}
                    title="Crosshair (Cross)"
                >
                    <Move className="h-4 w-4" />
                </Button>

                {/* Dot Tool */}
                <Button
                    variant={toolMode === "dot" ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setToolMode("dot")}
                    title="Dot"
                >
                    <Circle className="h-4 w-4" />
                </Button>

                <Button
                    variant={darkMode ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setDarkMode(!darkMode)}
                    title="Dark Mode"
                >
                    {darkMode ? (
                        <Sun className="h-4 w-4" />
                    ) : (
                        <Moon className="h-4 w-4" />
                    )}
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => {
                        if (chartRef.current) {
                            chartRef.current.timeScale().scrollToPosition(-5, false);
                        }
                    }}
                    title="Zoom In"
                >
                    <ZoomIn className="h-4 w-4" />
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => {
                        if (chartRef.current) {
                            chartRef.current.timeScale().scrollToPosition(5, false);
                        }
                    }}
                    title="Zoom Out"
                >
                    <ZoomOut className="h-4 w-4" />
                </Button>
            </div>

            {/* Main Chart Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Toolbar */}
                <div
                    className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
                    <div className="flex items-center gap-2">
                        {(["1D", "5D", "1M", "3M", "6M", "1Y"] as const).map((tf) => (
                            <Button
                                key={tf}
                                variant={timeframe === tf ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setTimeframe(tf)}
                                className="text-xs px-2 py-1 h-7"
                            >
                                {tf}
                            </Button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs">
                                    <Activity className="h-4 w-4 mr-1" />
                                    Indicators
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Indicators</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setShowEMA(!showEMA)}>
                                    EMA {emaPeriod} {showEMA ? "✓" : ""}
                                </DropdownMenuItem>
                                <div className="px-2 py-1 text-xs text-gray-500">
                                    EMA Period
                                </div>
                                <DropdownMenuItem onClick={() => setEmaPeriod(9)}>
                                    9 {emaPeriod === 9 ? "✓" : ""}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEmaPeriod(20)}>
                                    20 {emaPeriod === 20 ? "✓" : ""}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEmaPeriod(50)}>
                                    50 {emaPeriod === 50 ? "✓" : ""}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Chart Container */}
                <div className="flex-1 relative min-h-0 overflow-hidden">
                    {isLoading && (
                        <div
                            className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 z-10">
                            <Skeleton className="w-full h-full" />
                        </div>
                    )}
                    <div
                        ref={chartContainerRef}
                        className="w-full h-full"
                        style={{
                            width: "100%",
                            height: "100%",
                            position: "relative",
                            overflow: "hidden",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
