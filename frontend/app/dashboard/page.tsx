"use client";

import { TradingChart } from "@/components/trading-chart";
import { MostBoughtStocks } from "@/components/most-bought";
import { TopPerformers } from "@/components/top-performers";
import { TopMovements } from "@/components/top-movements";
import { SectorMovements } from "@/components/sector-movements";

export default function Dashboard() {
  return (
    <div className="p-4 space-y-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      <TradingChart />
      <MostBoughtStocks />
      <TopMovements />
      <TopPerformers />
      <SectorMovements />
    </div>
  );
import { redirect } from "next/navigation";

export default function Dashboard() {
  redirect("/dashboard/market");
}
