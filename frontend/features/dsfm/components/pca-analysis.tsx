"use client";

import { Layers, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PCAAnalysis() {
  const [loading, setLoading] = useState(false);
  const [pcaData, setPcaData] = useState<any>(null);

  useEffect(() => {
    void fetchPCAData();
  }, []);

  const fetchPCAData = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/dsfm/pca");
      if (resp.ok) {
        const data = await resp.json();
        setPcaData(data);
      }
    } catch (e) {
      console.error("Failed to fetch PCA data:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dimensionality Reduction & PCA</CardTitle>
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Roadmap / Q4 Beta
            </Badge>
          </div>
          <CardDescription>
            Principal Component Analysis to reduce asset return dimensions and
            identify latent market drivers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
              <div className="bg-primary/10 text-primary mb-4 rounded-full p-3">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">
                Principal Component Analysis Engine
              </h3>
              <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                Eigenvalue decomposition and cumulative variance ratio mapping
                across NIFTY sector portfolios are currently undergoing
                backtesting and benchmark verification.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Button variant="outline" size="sm" disabled>
                  Decomposition Spec
                </Button>
                <span className="text-muted-foreground text-xs">
                  Status: Staged for next release cycle
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
