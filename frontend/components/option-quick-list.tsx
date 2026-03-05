"use client";

import { ChevronRight, Link as LinkIcon, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { marketDataService } from "@/lib/market-data";

interface OptionQuickListProps {
    isOpen: boolean;
    onClose: () => void;
}

interface OptionData {
    strikePrice: number;
    type: "CE" | "PE";
    price: number;
    change: number;
    changePercent: number;
    ltp: number; // Underlying price
    oi?: number;
}

// Helper to generate strikes around ATM
function generateStrikes(ltp: number, step: number, count: number = 5) {
    const atm = Math.round(ltp / step) * step;
    const strikes = [];
    for (let i = -count; i <= count; i++) {
        strikes.push(atm + i * step);
    }
    return strikes;
}

export function OptionQuickList({ isOpen, onClose }: OptionQuickListProps) {
    const [selectedTab, setSelectedTab] = useState<
        "NIFTY" | "BANKNIFTY" | "FINNIFTY"
    >("NIFTY");
    const [expiryDate, setExpiryDate] = useState<string>("28 Nov 25");
    const [loading, setLoading] = useState(false);
    const [optionData, setOptionData] = useState<OptionData[]>([]);
    const [underlyingPrice, setUnderlyingPrice] = useState<number>(0);

    // Mock expiry dates
    const expiries = [
        "28 Nov 25",
        "05 Dec 25",
        "12 Dec 25",
        "19 Dec 25",
        "26 Dec 25",
    ];

    useEffect(() => {
        if (!isOpen) return;

        const fetchOptionChain = async () => {
            setLoading(true);
            try {
                // Get underlying price first
                const symbolMap = {
                    NIFTY: "NSE:NIFTY",
                    BANKNIFTY: "NSE:BANKNIFTY",
                    FINNIFTY: "NSE:FINNIFTY",
                };

                const marketData = await marketDataService.getMarketDataWithStatus(
                    symbolMap[selectedTab],
                );
                const ltp =
                    marketData.data?.price ||
                    (selectedTab === "NIFTY"
                        ? 24000
                        : selectedTab === "BANKNIFTY"
                            ? 52000
                            : 24000);
                setUnderlyingPrice(ltp);

                // Generate strikes
                const step =
                    selectedTab === "NIFTY" ? 50 : selectedTab === "BANKNIFTY" ? 100 : 50;
                const strikes = generateStrikes(ltp, step, 6);

                // Generate mock option data based on strikes (since we don't have real option chain API)
                // In a real app, this would fetch from an options API
                const data: OptionData[] = [];

                strikes.forEach((strike) => {
                    // Call simulation
                    const callPrice = Math.max(0.05, ltp - strike + Math.random() * 50);
                    const putPrice = Math.max(0.05, strike - ltp + Math.random() * 50);

                    // Add CE
                    data.push({
                        strikePrice: strike,
                        type: "CE",
                        price: strike < ltp ? callPrice + 100 : callPrice, // ITM calls cost more
                        change: Math.random() * 20 - 10,
                        changePercent: Math.random() * 10 - 5,
                        ltp: ltp,
                    });

                    // Add PE
                    data.push({
                        strikePrice: strike,
                        type: "PE",
                        price: strike > ltp ? putPrice + 100 : putPrice, // ITM puts cost more
                        change: Math.random() * 20 - 10,
                        changePercent: Math.random() * 10 - 5,
                        ltp: ltp,
                    });
                });

                setOptionData(data);
            } catch (error) {
                console.error("Failed to fetch option chain", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOptionChain();
        const interval = setInterval(fetchOptionChain, 5000);
        return () => clearInterval(interval);
    }, [isOpen, selectedTab]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 pointer-events-none">
            <div
                className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[80vh] sm:h-150 rounded-t-xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col pointer-events-auto">
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Option Quicklist
                    </h2>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon-sm" className="text-gray-500">
                            <LinkIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Tabs & Filters */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3">
                    <div className="flex items-center gap-6">
                        {(["NIFTY", "BANKNIFTY", "FINNIFTY"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSelectedTab(tab)}
                                className={`text-sm font-medium transition-colors relative pb-2 -mb-3.25 ${selectedTab === tab
                                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                    }`}
                            >
                                {tab.replace("NIFTY", " NIFTY").trim()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Expiry Scroll */}
                <div
                    className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {expiries.map((date) => (
                        <button
                            key={date}
                            onClick={() => setExpiryDate(date)}
                            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap border transition-colors ${expiryDate === date
                                ? "bg-white dark:bg-gray-800 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm"
                                : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800"
                                }`}
                        >
                            {date}
                        </button>
                    ))}
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Options Grid */}
                <div className="flex-1 overflow-auto p-4 bg-gray-50/50 dark:bg-gray-900/50">
                    {loading && optionData.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-sm text-gray-500">
                            Loading options chain...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* CE Column */}
                            <div className="space-y-2">
                                {optionData
                                    .filter((x) => x.type === "CE")
                                    .map((opt) => (
                                        <OptionCard key={`${opt.strikePrice}-CE`} data={opt} />
                                    ))}
                            </div>
                            {/* PE Column */}
                            <div className="space-y-2">
                                {optionData
                                    .filter((x) => x.type === "PE")
                                    .map((opt) => (
                                        <OptionCard key={`${opt.strikePrice}-PE`} data={opt} />
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function OptionCard({ data }: { data: OptionData }) {
    const isITM =
        data.type === "CE"
            ? data.ltp > data.strikePrice
            : data.ltp < data.strikePrice;
    const isPositive = data.change >= 0;

    return (
        <div
            className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:shadow-sm transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {data.strikePrice}
                    </span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {data.type}
                    </span>
                    <Badge
                        variant="secondary"
                        className={`text-[10px] h-5 px-1.5 rounded ${isITM
                            ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-100 dark:border-green-900"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                            }`}
                    >
                        {isITM ? "ITM" : "OTM"}
                    </Badge>
                </div>
                <div className="text-right">
                    <div
                        className={`text-sm font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}
                    >
                        ₹{data.price.toFixed(2)}
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between text-xs">
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-0.5 rounded text-[10px] font-medium">
                        B
                    </button>
                    <button
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-0.5 rounded text-[10px] font-medium">
                        S
                    </button>
                </div>
                <div
                    className={`text-right font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
                >
                    {isPositive ? "+" : ""}
                    {data.change.toFixed(2)} ({isPositive ? "+" : ""}
                    {data.changePercent.toFixed(2)}%)
                </div>
            </div>
        </div>
    );
}
