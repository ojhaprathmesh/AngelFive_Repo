"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CorrelationAnalysis() {
  const [loading, setLoading] = useState(false);
  const [correlationData, setCorrelationData] = useState<any>(null);

  useEffect(() => {
    fetchCorrelationData();
  }, []);

  const fetchCorrelationData = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/dsfm/correlation");
      if (resp.ok) {
        const data = await resp.json();
        setCorrelationData(data);
      }
    } catch (e) {
      console.error("Failed to fetch correlation data:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Correlation & Dependency Analysis</CardTitle>
          <CardDescription>
            Analyze asset relationships via Pearson/Spearman correlation, rolling metrics, and dynamic dependencies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : correlationData ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Correlation matrix visualization coming soon...
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Loading correlation data...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

