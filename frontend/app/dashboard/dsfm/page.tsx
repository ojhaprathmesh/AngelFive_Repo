"use client";

import { BarChart3, Layers, Network, PieChart, TrendingUp } from "lucide-react";

import { CorrelationAnalysis } from "@/components/dsfm/correlation-analysis";
import { NetworkAnalysis } from "@/components/dsfm/network-analysis";
import { PCAAnalysis } from "@/components/dsfm/pca-analysis";
import { PortfolioOptimization } from "@/components/dsfm/portfolio-optimization";
import { ReturnsAnalysis } from "@/components/dsfm/returns-analysis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DSFMPage() {
    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Data Science in Financial Markets
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Advanced analytics, statistical modeling, and portfolio optimization tools
                </p>
            </div>

            <Tabs defaultValue="returns" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
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
                    <TabsTrigger value="network" className="flex items-center gap-2">
                        <Network className="h-4 w-4" />
                        Network Analysis
                    </TabsTrigger>
                    <TabsTrigger value="pca" className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        PCA
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
                <TabsContent value="network" className="mt-6">
                    <NetworkAnalysis />
                </TabsContent>
                <TabsContent value="pca" className="mt-6">
                    <PCAAnalysis />
                </TabsContent>
            </Tabs>
        </div>
    );
}