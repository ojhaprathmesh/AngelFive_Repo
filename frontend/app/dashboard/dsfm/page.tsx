"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReturnsAnalysis } from "@/components/dsfm/returns-analysis";
import { CorrelationAnalysis } from "@/components/dsfm/correlation-analysis";
import { PortfolioOptimization } from "@/components/dsfm/portfolio-optimization";
import { BarChart3, TrendingUp, PieChart } from "lucide-react";

export default function DSFMPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Data Science in Financial Markets
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Advanced analytics, statistical modeling, and portfolio optimization
          tools
        </p>
      </div>

      <Tabs defaultValue="returns" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="returns" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Returns Analysis
          </TabsTrigger>
          <TabsTrigger value="correlation" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Correlation
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Portfolio Optimization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="returns" className="mt-6">
          <ReturnsAnalysis />
        </TabsContent>

        <TabsContent value="correlation" className="mt-6">
          <CorrelationAnalysis />
        </TabsContent>

        <TabsContent value="portfolio" className="mt-6">
          <PortfolioOptimization />
        </TabsContent>
      </Tabs>
    </div>
  );
}
