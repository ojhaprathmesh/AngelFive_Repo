"use client";

import { CheckCircle, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ADFTestResult } from "@/features/dsfm/types";

interface StationarityTabProps {
  adfResult: ADFTestResult | null;
  loadingADF: boolean;
}

export function StationarityTab({
  adfResult,
  loadingADF,
}: StationarityTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Augmented Dickey-Fuller (ADF) Test</CardTitle>
        <CardDescription>
          Tests for stationarity of log returns. Null hypothesis: series has a
          unit root (non-stationary)
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
                  <Badge className="bg-green-100 text-green-800">
                    Stationary
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <Badge className="bg-red-100 text-red-800">
                    Non-Stationary
                  </Badge>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Test Statistic
                </p>
                <p className="text-lg font-bold">
                  {adfResult.testStatistic.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  P-Value
                </p>
                <p className="text-lg font-bold">
                  {adfResult.pValue === 0 || adfResult.pValue < 0.0001
                    ? "< 0.0001"
                    : adfResult.pValue.toFixed(4)}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Critical Values</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">1%:</span>
                  <span className="font-mono text-sm">
                    {adfResult.criticalValues["1%"].toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">5%:</span>
                  <span className="font-mono text-sm">
                    {adfResult.criticalValues["5%"].toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">10%:</span>
                  <span className="font-mono text-sm">
                    {adfResult.criticalValues["10%"].toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="mb-1 text-sm font-semibold">Interpretation:</p>
              <p className="text-sm">{adfResult.interpretation}</p>
              <p className="mt-2 text-sm font-semibold">Recommendation:</p>
              <p className="text-sm">{adfResult.recommendation}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Click to run ADF test</p>
        )}
      </CardContent>
    </Card>
  );
}
