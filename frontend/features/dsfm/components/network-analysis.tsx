"use client";

import { Network, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
          <div className="flex items-center justify-between">
            <CardTitle>Network Analysis & Market Dynamics</CardTitle>
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Roadmap / Q4 Beta
            </Badge>
          </div>
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
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
              <div className="bg-primary/10 text-primary mb-4 rounded-full p-3">
                <Network className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">
                Minimum Spanning Tree & Graph Topology
              </h3>
              <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                Correlation-distance metric transformation (d_ij = √(2(1 -
                ρ_ij))) and Kruskal MST graph rendering are staged for graph
                visualization integration.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Button variant="outline" size="sm" disabled>
                  Topology Spec
                </Button>
                <span className="text-muted-foreground text-xs">
                  Status: Staged for next release cycle
                </span>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-muted-foreground text-xs">
          Network topology is derived from the correlation matrix using Minimum
          Spanning Tree (MST) algorithm.
        </CardFooter>
      </Card>
    </div>
  );
}
