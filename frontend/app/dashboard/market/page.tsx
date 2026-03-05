import MarketDiscovery from "@/components/market-discovery";
import { TradingChart } from "@/components/trading-chart";

export default function MarketPage() {
    return (
        <div className="w-full space-y-6 p-4 md:p-4 min-h-screen bg-gray-50 dark:bg-gray-900">
            <TradingChart />
            <MarketDiscovery />
        </div>
    );
}
