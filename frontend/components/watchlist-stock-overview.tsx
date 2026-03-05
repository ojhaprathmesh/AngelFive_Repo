"use client";

import { ArrowDownRight, ArrowUpRight, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StockOverviewData = {
    symbol: string;
    companyName: string;
    industry?: string | null;
    lastPrice: number | null;
    change: number | null;
    pChange: number | null;
    open: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    previousClose: number | null;
    averagePrice: number | null;
    totalTradedVolume: number | null;
    totalTradedValue: number | null;
    upperCircuit: number | null;
    lowerCircuit: number | null;
    weekHigh: number | null;
    weekHighDate?: string | null;
    weekLow: number | null;
    weekLowDate?: string | null;
    faceValue?: number | null;
    isin?: string | null;
    marketCap?: number | null;
    pe?: number | null;
    pb?: number | null;
    eps?: number | null;
    dividendYield?: number | null;
    roe?: number | null;
    beta?: number | null;
    sectorPe?: number | null;
    lastUpdateTime?: string | null;
};

interface StockOverviewPanelProps {
    symbol: string;
    exchange?: string;
}

const formatNumber = (
    value: number | null | undefined,
    options?: Intl.NumberFormatOptions,
) => {
    if (value == null || Number.isNaN(value)) return "—";
    return value.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        ...options,
    });
};

const formatInteger = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return "—";
    if (value >= 1_00_00_000) {
        return `${(value / 1_00_00_000).toFixed(2)} Cr`;
    }
    if (value >= 1_00_000) {
        return `${(value / 1_00_000).toFixed(2)} L`;
    }
    return value.toLocaleString("en-IN");
};

const clampPercentage = (value: number) => {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
};

export function StockOverviewPanel({
    symbol,
    exchange = "NSE",
}: StockOverviewPanelProps) {
    const [data, setData] = useState<StockOverviewData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!symbol) return;
        setLoading(true);
        setError(null);

        const controller = new AbortController();
        const load = async () => {
            try {
                const resp = await fetch(
                    `/api/market/stock-overview?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}`,
                    { signal: controller.signal },
                );
                if (!resp.ok) {
                    throw new Error(`Failed to load stock overview (${resp.status})`);
                }
                const json = await resp.json();
                setData(json?.data || null);
            } catch (err) {
                if ((err as DOMException).name === "AbortError") return;
                console.error("[StockOverview] Error fetching overview:", err);
                setError(
                    err instanceof Error ? err.message : "Unable to load stock overview",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => controller.abort();
    }, [symbol, exchange]);

    const priceDirection = data?.change
        ? data.change >= 0
            ? "up"
            : "down"
        : "flat";

    const circuitProgress = useMemo(() => {
        if (
            data?.lastPrice == null ||
            data.lowerCircuit == null ||
            data.upperCircuit == null ||
            data.upperCircuit - data.lowerCircuit === 0
        ) {
            return null;
        }
        const pct =
            ((data.lastPrice - data.lowerCircuit) /
                (data.upperCircuit - data.lowerCircuit)) *
            100;
        return clampPercentage(pct);
    }, [data?.lastPrice, data?.lowerCircuit, data?.upperCircuit]);

    const weekRangeProgress = useMemo(() => {
        if (
            data?.lastPrice == null ||
            data.weekLow == null ||
            data.weekHigh == null ||
            data.weekHigh - data.weekLow === 0
        ) {
            return null;
        }
        const pct =
            ((data.lastPrice - data.weekLow) / (data.weekHigh - data.weekLow)) * 100;
        return clampPercentage(pct);
    }, [data?.lastPrice, data?.weekHigh, data?.weekLow]);

    if (!symbol) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                Select a stock to view detailed overview
            </div>
        );
    }

    if (loading && !data) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    return (
        <div className="h-full w-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {data.companyName || data.symbol}
                                </h1>
                                <Badge variant="secondary">{exchange}</Badge>
                            </div>
                            {data.industry && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {data.industry}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                                    {formatNumber(data.lastPrice)}
                                </div>
                                <div
                                    className={cn(
                                        "flex items-center text-sm font-semibold",
                                        priceDirection === "up" && "text-green-600",
                                        priceDirection === "down" && "text-red-600",
                                        priceDirection === "flat" && "text-gray-500",
                                    )}
                                >
                                    {priceDirection === "up" && (
                                        <ArrowUpRight className="h-4 w-4 mr-1" />
                                    )}
                                    {priceDirection === "down" && (
                                        <ArrowDownRight className="h-4 w-4 mr-1" />
                                    )}
                                    {formatNumber(data.change, { minimumFractionDigits: 2 })} (
                                    {formatNumber(data.pChange, { minimumFractionDigits: 2 })}%)
                                </div>
                            </div>
                            <Button variant="outline" size="icon" className="h-9 w-9">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            </Button>
                        </div>
                    </div>
                    {loading && (
                        <p className="text-xs text-gray-400">Refreshing overview…</p>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <MetricGroup
                        title="Activity"
                        metrics={[
                            { label: "Open", value: data.open },
                            { label: "High", value: data.dayHigh },
                            { label: "Low", value: data.dayLow },
                            { label: "Prev Close", value: data.previousClose },
                        ]}
                    />
                    <MetricGroup
                        title="Price Details"
                        metrics={[
                            { label: "Average Price (VWAP)", value: data.averagePrice },
                            {
                                label: "Volume",
                                value: data.totalTradedVolume,
                                formatter: formatInteger,
                            },
                            {
                                label: "Traded Value",
                                value: data.totalTradedValue,
                                formatter: formatInteger,
                            },
                            {
                                label: "Market Cap",
                                value: data.marketCap,
                                formatter: formatInteger,
                            },
                        ]}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(data.lowerCircuit != null || data.upperCircuit != null) && (
                        <RangeCard
                            title="Lower Circuit / Upper Circuit"
                            lowLabel={formatNumber(data.lowerCircuit)}
                            highLabel={formatNumber(data.upperCircuit)}
                            progress={circuitProgress}
                        />
                    )}
                    {(data.weekLow != null || data.weekHigh != null) && (
                        <RangeCard
                            title="52 Week Low / High"
                            lowLabel={`${formatNumber(data.weekLow)}${data.weekLowDate ? ` (${data.weekLowDate})` : ""}`}
                            highLabel={`${formatNumber(data.weekHigh)}${data.weekHighDate ? ` (${data.weekHighDate})` : ""}`}
                            progress={weekRangeProgress}
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <FundamentalsCard data={data} exchange={exchange} />
                </div>
            </div>
        </div>
    );
}

interface MetricProps {
    label: string;
    value: number | string | null | undefined;
    prefix?: string;
    formatter?: (value: any) => string;
    hideWhenEmpty?: boolean;
}

function Metric(props: MetricProps) {
    const { label, hideWhenEmpty = true } = props;
    const hasValue = metricHasValue(props);

    if (hideWhenEmpty && !hasValue) {
        return null;
    }

    const display = formatMetricDisplay(props);

    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </div>
            <div className="text-base font-semibold text-gray-900 dark:text-white">
                {display}
            </div>
        </div>
    );
}

function metricHasValue(metric: MetricProps) {
    if (metric.formatter) {
        return (
            metric.value !== null &&
            metric.value !== undefined &&
            !(typeof metric.value === "number" && Number.isNaN(metric.value))
        );
    }
    if (typeof metric.value === "number") {
        return !Number.isNaN(metric.value);
    }
    if (typeof metric.value === "string") {
        return metric.value.trim().length > 0;
    }
    return metric.value !== null && metric.value !== undefined;
}

function formatMetricDisplay(metric: MetricProps) {
    if (metric.formatter) {
        return metric.formatter(metric.value);
    }
    if (typeof metric.value === "number") {
        return `${metric.prefix || ""}${formatNumber(metric.value)}`;
    }
    if (typeof metric.value === "string" && metric.value.trim().length > 0) {
        return metric.value;
    }
    return "—";
}

interface RangeCardProps {
    title: string;
    lowLabel: string;
    highLabel: string;
    progress: number | null;
}

function RangeCard({ title, lowLabel, highLabel, progress }: RangeCardProps) {
    if (lowLabel === "—" && highLabel === "—" && progress == null) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-gray-900 p-3">
            <div className="text-xs font-medium text-gray-900 dark:text-white mb-3">
                {title}
            </div>
            <div className="space-y-3">
                <div className="relative">
                    <div className="w-full h-1.5 bg-linear-to-r from-[#d64d4d] to-[#029076] rounded-full"></div>
                    {progress != null && (
                        <div
                            className="absolute -top-2 transition-all duration-300"
                            style={{
                                left: `${progress}%`,
                                transform: "translateX(-50%) translateY(-40%) rotate(180deg)",
                            }}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                className="text-gray-800 dark:text-white"
                                fill="currentColor"
                            >
                                <path d="M8 0L16 16H0L8 0Z" />
                            </svg>
                        </div>
                    )}
                </div>
                <div className="flex justify-between text-xs">
                    <div>
                        <div className="text-gray-900 dark:text-white font-medium">
                            {lowLabel}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">Low</div>
                    </div>
                    <div className="text-right">
                        <div className="text-gray-900 dark:text-white font-medium">
                            {highLabel}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">High</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface MetricGroupProps {
    title: string;
    metrics: MetricProps[];
}

function MetricGroup({ title, metrics }: MetricGroupProps) {
    const filtered = metrics.filter((metric) => metricHasValue(metric));

    if (filtered.length === 0) {
        return null;
    }

    return (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <div className="px-4 pt-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {title}
            </div>
            <div
                className="grid grid-cols-2 md:grid-cols-4 text-sm divide-y divide-gray-100 dark:divide-gray-800 md:divide-y-0 md:divide-x">
                {filtered.map((metric, idx) => (
                    <div key={idx} className="p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {metric.label}
                        </div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatMetricDisplay(metric)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FundamentalsCard({
    data,
    exchange,
}: {
    data: StockOverviewData;
    exchange: string;
}) {
    const fundamentals = [
        { label: "PE Ratio", value: data.pe },
        { label: "PB Ratio", value: data.pb },
        {
            label: "ROE",
            value: data.roe,
            formatter: (val: number | null | undefined) =>
                val != null ? `${val.toFixed(2)}%` : "—",
        },
        {
            label: "Dividend Yield",
            value: data.dividendYield,
            formatter: (val: number | null | undefined) =>
                val != null ? `${val.toFixed(2)}%` : "—",
        },
        { label: "Face Value", value: data.faceValue, prefix: "₹" },
        { label: "Beta", value: data.beta },
        { label: "Exchange", value: exchange },
    ];

    const filtered = fundamentals.filter((metric) => metricHasValue(metric));

    if (filtered.length === 0) {
        return null;
    }

    return (
        <div
            className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Fundamental Ratios
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
                {filtered.map((metric, idx) => (
                    <Metric key={`${metric.label}-${idx}`} {...metric} />
                ))}
            </div>
        </div>
    );
}
