"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PortfolioOptimization() {
  const [loading, setLoading] = useState(false);
  const [portfolioData, setPortfolioData] = useState<any>(null);

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/dsfm/portfolio-optimization");
      if (resp.ok) {
        const data = await resp.json();
        setPortfolioData(data);
      }
    } catch (e) {
      console.error("Failed to fetch portfolio data:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Optimization (MPT)</CardTitle>
          <CardDescription>
            Modern Portfolio Theory - Mean-Variance Optimization, Efficient Frontier, and Risk-Return Analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : portfolioData ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Efficient frontier and portfolio optimization coming soon...
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Loading portfolio optimization data...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

