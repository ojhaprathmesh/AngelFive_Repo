import { Activity, BarChart3, TrendingDown, TrendingUp } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReturnsData } from "@/features/dsfm/types";

interface ReturnsStatsGridProps {
  returnsData: ReturnsData;
}

export function ReturnsStatsGrid({ returnsData }: ReturnsStatsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Mean Return Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Mean Return
          </CardTitle>
          <CardAction>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {(returnsData.meanReturn * 100).toFixed(2)}%
          </p>
        </CardContent>
        {returnsData.calculations && (
          <CardFooter className="text-xs text-gray-500">
            {returnsData.calculations.meanReturn.description}
          </CardFooter>
        )}
      </Card>

      {/* Volatility Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Volatility (σ)
          </CardTitle>
          <CardAction>
            <Activity className="h-8 w-8 text-blue-500" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {(returnsData.volatility * 100).toFixed(2)}%
          </p>
        </CardContent>
        {returnsData.calculations && (
          <CardFooter className="text-xs text-gray-500">
            {returnsData.calculations.volatility.description}
          </CardFooter>
        )}
      </Card>

      {/* Sharpe Ratio Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Sharpe Ratio
          </CardTitle>
          <CardAction>
            <BarChart3 className="h-8 w-8 text-purple-500" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {returnsData.sharpeRatio.toFixed(2)}
          </p>
        </CardContent>
        {returnsData.calculations && (
          <CardFooter className="text-xs text-gray-500">
            {returnsData.calculations.sharpeRatio.description}
          </CardFooter>
        )}
      </Card>

      {/* Range Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Range
          </CardTitle>
          <CardAction>
            <TrendingDown className="h-8 w-8 text-red-500" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-semibold">
            {(returnsData.minReturn * 100).toFixed(2)}% to{" "}
            {(returnsData.maxReturn * 100).toFixed(2)}%
          </p>
        </CardContent>
        {returnsData.calculations && (
          <CardFooter className="text-xs text-gray-500">
            {returnsData.calculations.range.description}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
