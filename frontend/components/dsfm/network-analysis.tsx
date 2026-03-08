"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function NetworkAnalysis() {
    const [loading, setLoading] = useState(false);
    const [networkData, setNetworkData] = useState<any>(null);

    const fetchNetworkData = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await fetch("/api/dsfm/network");
            if (resp.ok) {
                const data = await resp.json();
                setNetworkData(data);
            }
        } catch (e) {
            console.error("Failed to fetch network data:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchNetworkData();
    }, [fetchNetworkData]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Network Analysis & Market Dynamics</CardTitle>
                    <CardDescription>
                        Construct financial networks from correlation matrices using Minimum
                        Spanning Tree (MST) to analyze network topology and systemic risk
                    </CardDescription>
                    <CardAction>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void fetchNetworkData()}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-96 w-full" />
                    ) : networkData ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Network graph and MST visualization coming soon...
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Loading network analysis...
                        </div>
                    )}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                    Network topology is derived from the correlation matrix using Minimum Spanning Tree (MST) algorithm.
                </CardFooter>
            </Card>
        </div>
    );
}
