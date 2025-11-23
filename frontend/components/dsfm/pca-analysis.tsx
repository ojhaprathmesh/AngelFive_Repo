"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PCAAnalysis() {
  const [loading, setLoading] = useState(false);
  const [pcaData, setPcaData] = useState<any>(null);

  useEffect(() => {
    fetchPCAData();
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
          <CardTitle>Dimensionality Reduction & PCA</CardTitle>
          <CardDescription>
            Principal Component Analysis to reduce data dimensions and identify asset groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : pcaData ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                PCA visualization and component analysis coming soon...
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Loading PCA analysis...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

