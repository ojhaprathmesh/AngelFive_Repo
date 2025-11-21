import { TradingChart } from "@/components/trading-chart";
import MarketDiscovery from "@/components/market-discovery";

export default function MarketPage() {
  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full space-y-6 px-2 md:px-4">
        <TradingChart />
        <MarketDiscovery />
      </div>
    </div>
  );
}
