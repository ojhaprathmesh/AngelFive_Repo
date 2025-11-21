import { TradingChart } from "@/components/trading-chart";

export default function MarketPage() {
  return (
    <div className="flex justify-center p-2 min-h-screen bg-gray-50 dark:bg-gray-900">
      <TradingChart />
    </div>
  );
}
