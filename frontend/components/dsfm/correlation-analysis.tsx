"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectItem, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createChart, ColorType, HistogramSeries } from "lightweight-charts";

export function CorrelationAnalysis() {
  const [loading, setLoading] = useState(false);
  const [correlationData, setCorrelationData] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<string>("3M");
  const [showRMT, setShowRMT] = useState<boolean>(true);
  const correlationChartRef = useRef<HTMLDivElement>(null);
  const eigenvalueChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCorrelationData();
  }, [timeframe]);

  useEffect(() => {
    if (correlationData && correlationChartRef.current) {
      renderCorrelationHeatmap(correlationData);
    }
  }, [correlationData, showRMT]);

  useEffect(() => {
    if (correlationData?.eigenvalues && eigenvalueChartRef.current) {
      renderEigenvalueSpectrum(correlationData.eigenvalues);
    }
  }, [correlationData]);

  const fetchCorrelationData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/dsfm/correlation?timeframe=${timeframe}&rmt=${showRMT}`);
      if (resp.ok) {
        const data = await resp.json();
        setCorrelationData(data);
      } else {
        const errorData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        console.error("Correlation error:", errorData.error || errorData.message);
      }
    } catch (e) {
      console.error("Failed to fetch correlation data:", e);
    } finally {
      setLoading(false);
    }
  };

  const renderCorrelationHeatmap = (data: any) => {
    if (!correlationChartRef.current || !data.correlationMatrix || !data.symbols) return;
    
    correlationChartRef.current.innerHTML = '';
    
    const matrix = showRMT && data.rmtFilteredMatrix ? data.rmtFilteredMatrix : data.correlationMatrix;
    const symbols = data.symbols;
    
    // Create a simple HTML table heatmap
    const table = document.createElement('table');
    table.className = 'w-full border-collapse';
    table.style.fontSize = '10px';
    
    // Header row
    const headerRow = document.createElement('tr');
    const emptyCell = document.createElement('th');
    emptyCell.className = 'p-1 text-xs font-semibold';
    headerRow.appendChild(emptyCell);
    
    symbols.forEach((sym: string) => {
      const th = document.createElement('th');
      th.className = 'p-1 text-xs font-semibold rotate-45 origin-bottom-left';
      th.textContent = sym.substring(0, 6);
      th.style.width = '30px';
      th.style.height = '80px';
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Data rows
    matrix.forEach((row: number[], i: number) => {
      const tr = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.className = 'p-1 text-xs font-semibold';
      labelCell.textContent = symbols[i].substring(0, 6);
      tr.appendChild(labelCell);
      
      row.forEach((val: number, j: number) => {
        const td = document.createElement('td');
        td.className = 'p-1 text-center';
        const intensity = Math.abs(val);
        const color = val >= 0 
          ? `rgba(34, 197, 94, ${intensity})` 
          : `rgba(239, 68, 68, ${intensity})`;
        td.style.backgroundColor = color;
        td.style.color = intensity > 0.5 ? 'white' : 'black';
        td.textContent = val.toFixed(2);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    
    correlationChartRef.current.appendChild(table);
  };

  const renderEigenvalueSpectrum = (eigenvalues: number[]) => {
    if (!eigenvalueChartRef.current || !eigenvalues || eigenvalues.length === 0) return;
    
    eigenvalueChartRef.current.innerHTML = '';
    
    const chart = createChart(eigenvalueChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#374151" },
      width: eigenvalueChartRef.current.clientWidth,
      height: 300,
      grid: { vertLines: { color: "#e5e7eb" }, horzLines: { color: "#e5e7eb" } },
    });

    // Sort eigenvalues in descending order
    const sortedEigenvalues = [...eigenvalues].sort((a, b) => b - a);
    
    // Create bar chart data
    const data = sortedEigenvalues.map((val, idx) => ({
      time: idx as any,
      value: val,
    }));

    const series = chart.addHistogramSeries({
      color: "#3b82f6",
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    
    series.setData(data);
    chart.timeScale().fitContent();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Correlation & Dependency Analysis</CardTitle>
          <CardDescription>
            Analyze asset relationships via correlation matrices, Random Matrix Theory (RMT) filtering, and eigenvalue spectrum
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Timeframe</label>
              <Select 
                value={timeframe} 
                onChange={(e) => {
                  setTimeframe(e.target.value);
                }}
              >
                <SelectValue />
                <SelectItem value="3M">3 Months</SelectItem>
                <SelectItem value="1Y">1 Year</SelectItem>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rmt-filter"
                checked={showRMT}
                onChange={(e) => setShowRMT(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="rmt-filter" className="text-sm">Apply RMT Filter</label>
            </div>
            <Button onClick={fetchCorrelationData} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : correlationData ? (
            <Tabs defaultValue="matrix" className="w-full">
              <TabsList>
                <TabsTrigger value="matrix">Correlation Matrix</TabsTrigger>
                <TabsTrigger value="eigenvalues">Eigenvalue Spectrum</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>

              <TabsContent value="matrix" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {showRMT ? 'RMT-Filtered' : 'Raw'} Correlation Matrix
                    </CardTitle>
                    <CardDescription>
                      {showRMT 
                        ? 'Noise-filtered correlation matrix using Random Matrix Theory'
                        : 'Raw correlation matrix showing all pairwise correlations'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-96">
                      <div ref={correlationChartRef} className="w-full" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="eigenvalues" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Eigenvalue Spectrum</CardTitle>
                    <CardDescription>
                      Eigenvalues of the correlation matrix. Large eigenvalues indicate significant market structure.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {correlationData.eigenvalues && (
                      <>
                        <div ref={eigenvalueChartRef} className="w-full" style={{ height: "300px" }} />
                        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Largest Eigenvalue (λ₁):</span>
                            <p className="text-xl font-bold">{correlationData.eigenvalues[0]?.toFixed(3)}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">RMT Threshold:</span>
                            <p className="text-xl font-bold">{correlationData.rmtThreshold?.toFixed(3) || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Significant Eigenvalues:</span>
                            <p className="text-xl font-bold">{correlationData.significantEigenvalues || 'N/A'}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="insights" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Market Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {correlationData.insights && correlationData.insights.length > 0 ? (
                      correlationData.insights.map((insight: string, idx: number) => (
                        <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm">{insight}</p>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-2">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm">
                            <strong>Market Structure:</strong> The largest eigenvalue (λ₁) indicates the overall market mode. 
                            {correlationData.eigenvalues?.[0] > 10 
                              ? ' High value suggests strong collective market movements.' 
                              : ' Moderate value suggests diversified market behavior.'}
                          </p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-sm">
                            <strong>RMT Analysis:</strong> Eigenvalues above the RMT threshold represent genuine market structure, 
                            while those below are likely noise from random correlations.
                          </p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <p className="text-sm">
                            <strong>Correlation Strength:</strong> {correlationData.symbols?.length || 0} stocks analyzed. 
                            Average correlation: {correlationData.averageCorrelation?.toFixed(3) || 'N/A'}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Click "Refresh" to load correlation analysis
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
