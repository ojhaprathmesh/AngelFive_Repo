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
    
    const matrix = data.correlationMatrix;
    const symbols = data.symbols;
    
    // Create a modern HTML table heatmap
    const table = document.createElement('table');
    table.className = 'w-full border-collapse text-xs';
    table.style.fontSize = '11px';
    
    // Header row
    const headerRow = document.createElement('tr');
    const emptyCell = document.createElement('th');
    emptyCell.className = 'p-2 bg-gray-100 dark:bg-gray-800 sticky top-0 left-0 z-20';
    headerRow.appendChild(emptyCell);
    
    symbols.forEach((sym: string) => {
      const th = document.createElement('th');
      th.className = 'p-2 bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 border-b-2 border-gray-300 dark:border-gray-600';
      const symText = sym.replace('-EQ', '').substring(0, 8);
      th.innerHTML = `<div class="transform -rotate-45 origin-center whitespace-nowrap font-bold text-gray-700 dark:text-gray-300" style="height: 60px; display: flex; align-items: flex-end; justify-content: flex-start;">${symText}</div>`;
      th.style.minWidth = '40px';
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Data rows
    matrix.forEach((row: number[], i: number) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors';
      
      const labelCell = document.createElement('td');
      labelCell.className = 'p-2 font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 sticky left-0 z-10 border-r-2 border-gray-300 dark:border-gray-600';
      labelCell.textContent = symbols[i].replace('-EQ', '').substring(0, 8);
      labelCell.style.minWidth = '80px';
      tr.appendChild(labelCell);
      
      row.forEach((val: number | null | undefined, j: number) => {
        const td = document.createElement('td');
        td.className = 'p-2 text-center font-semibold border border-gray-200 dark:border-gray-700 transition-all hover:scale-110 hover:z-30 hover:shadow-lg cursor-pointer';
        
        // Handle null/undefined values
        if (val === null || val === undefined || isNaN(val)) {
          td.textContent = 'N/A';
          td.style.backgroundColor = 'rgb(243, 244, 246)';
          td.style.color = 'rgb(156, 163, 175)';
          td.title = `${symbols[i]} vs ${symbols[j]}: No data`;
          tr.appendChild(td);
          return;
        }
        
        const intensity = Math.abs(val);
        let color: string;
        
        if (i === j) {
          // Diagonal - neutral gray
          color = 'rgb(229, 231, 235)';
          td.style.color = 'rgb(55, 65, 81)';
        } else if (val >= 0) {
          // Positive correlation - green gradient
          const greenIntensity = Math.pow(intensity, 0.7); // Non-linear for better visibility
          color = `rgba(34, 197, 94, ${greenIntensity})`;
          td.style.color = greenIntensity > 0.5 ? 'white' : 'rgb(22, 101, 52)';
        } else {
          // Negative correlation - red gradient
          const redIntensity = Math.pow(intensity, 0.7);
          color = `rgba(239, 68, 68, ${redIntensity})`;
          td.style.color = redIntensity > 0.5 ? 'white' : 'rgb(127, 29, 29)';
        }
        
        td.style.backgroundColor = color;
        td.textContent = val.toFixed(2);
        td.title = `${symbols[i]} vs ${symbols[j]}: ${val.toFixed(3)}`;
        
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
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-48">
              <label className="text-sm font-semibold mb-2 block text-gray-700 dark:text-gray-300">Timeframe</label>
              <Select 
                value={timeframe} 
                onChange={(e) => {
                  setTimeframe(e.target.value);
                }}
              >
                <SelectValue />
                <SelectItem value="1M">1 Month</SelectItem>
                <SelectItem value="3M">3 Months</SelectItem>
                <SelectItem value="6M">6 Months</SelectItem>
                <SelectItem value="1Y">1 Year</SelectItem>
              </Select>
            </div>
            <Button onClick={fetchCorrelationData} disabled={loading} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
              {loading ? 'Loading...' : 'Analyze Correlations'}
            </Button>
            <div className="ml-auto text-sm text-gray-500">
              Analyzing all 50 NIFTY 50 stocks
            </div>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Correlation Matrix Heatmap</CardTitle>
                        <CardDescription className="mt-1">
                          Pairwise correlations between stock returns. Green = positive, Red = negative correlation.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Color Scale:</span>
                        <div className="flex gap-1">
                          <div className="w-12 h-6 rounded" style={{background: 'linear-gradient(to right, rgba(239,68,68,1), rgba(239,68,68,0))'}}></div>
                          <span className="text-xs text-gray-500">0</span>
                          <div className="w-12 h-6 rounded" style={{background: 'linear-gradient(to right, rgba(34,197,94,0), rgba(34,197,94,1))'}}></div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-[600px] border-2 border-gray-200 dark:border-gray-700 rounded-lg">
                      <div ref={correlationChartRef} className="w-full" />
                    </div>
                    {correlationData?.averageCorrelation && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Average Correlation:</span>
                          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{correlationData.averageCorrelation.toFixed(3)}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                          {correlationData.averageCorrelation > 0.5 ? 'High correlation - stocks move together' : 
                           correlationData.averageCorrelation > 0.3 ? 'Moderate correlation - some co-movement' :
                           'Low correlation - diversified movements'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="eigenvalues" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Eigenvalue Spectrum Analysis</CardTitle>
                    <CardDescription>
                      Eigenvalues reveal market structure. Values above RMT threshold indicate genuine correlations vs random noise.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {correlationData.eigenvalues && (
                      <>
                        <div ref={eigenvalueChartRef} className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4" style={{ height: "350px" }} />
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-900">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Largest Eigenvalue (λ₁)</div>
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{correlationData.eigenvalues[0]?.toFixed(2)}</div>
                            <div className="text-xs text-gray-500 mt-2">Market mode strength</div>
                          </div>
                          <div className="p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-900">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">RMT Threshold (λ_max)</div>
                            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{correlationData.rmtThreshold?.toFixed(2) || 'N/A'}</div>
                            <div className="text-xs text-gray-500 mt-2">Noise cutoff level</div>
                          </div>
                          <div className="p-4 rounded-xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-900">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Significant Factors</div>
                            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{correlationData.significantEigenvalues || 0}</div>
                            <div className="text-xs text-gray-500 mt-2">Above RMT threshold</div>
                          </div>
                        </div>
                        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>📊 Interpretation:</strong> {correlationData.significantEigenvalues > 3 
                              ? `High market structure with ${correlationData.significantEigenvalues} dominant factors driving stock movements.`
                              : correlationData.significantEigenvalues > 1
                              ? `Moderate market structure with ${correlationData.significantEigenvalues} main factors.`
                              : 'Low market structure - stocks moving independently.'}
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="insights" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Market Structure Insights</CardTitle>
                    <CardDescription>
                      Understanding correlation patterns and their implications for portfolio diversification
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-900">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">λ₁</div>
                          <div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">Market Mode</div>
                            <div className="text-xs text-gray-500">Dominant factor</div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          The largest eigenvalue (λ₁ = {correlationData.eigenvalues?.[0]?.toFixed(2)}) represents the strength of the dominant market factor.
                          {correlationData.eigenvalues?.[0] > 10 
                            ? ' 🔴 Strong collective movements - high systemic risk.' 
                            : correlationData.eigenvalues?.[0] > 5
                            ? ' 🟡 Moderate market coupling - balanced risk.'
                            : ' 🟢 Weak coupling - good diversification potential.'}
                        </p>
                      </div>

                      <div className="p-5 rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-900">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">RMT</div>
                          <div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">Noise Filtering</div>
                            <div className="text-xs text-gray-500">Random Matrix Theory</div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          RMT threshold = {correlationData.rmtThreshold?.toFixed(2)}. Eigenvalues above this represent genuine market structure.
                          Found {correlationData.significantEigenvalues || 0} significant factors beyond random noise.
                        </p>
                      </div>

                      <div className="p-5 rounded-xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-900">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">ρ̄</div>
                          <div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">Average Correlation</div>
                            <div className="text-xs text-gray-500">Portfolio metric</div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Average correlation = {correlationData.averageCorrelation?.toFixed(3)}.
                          {correlationData.averageCorrelation > 0.5 
                            ? ' 🔴 High - limited diversification benefits.'
                            : correlationData.averageCorrelation > 0.3
                            ? ' 🟡 Moderate - decent diversification possible.'
                            : ' 🟢 Low - excellent diversification opportunity.'}
                        </p>
                      </div>

                      <div className="p-5 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-900">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold">N</div>
                          <div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">Sample Size</div>
                            <div className="text-xs text-gray-500">Data quality</div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Analyzed {correlationData.symbols?.length || 0} stocks from NIFTY 50.
                          Larger samples provide more reliable correlation estimates and better RMT filtering.
                        </p>
                      </div>
                    </div>

                    <div className="p-5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border-2 border-blue-300 dark:border-blue-700">
                      <h4 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-200">💡 Portfolio Implications</h4>
                      <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                          <span><strong>Diversification:</strong> {correlationData.averageCorrelation < 0.3 ? 'Good - stocks move independently' : 'Limited - stocks tend to move together'}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                          <span><strong>Systemic Risk:</strong> {correlationData.significantEigenvalues > 3 ? 'High - market driven by few factors' : 'Low - multiple independent factors'}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                          <span><strong>Recommendation:</strong> {correlationData.averageCorrelation < 0.3 && correlationData.significantEigenvalues < 3 ? 'Favorable conditions for diversified portfolio' : 'Consider sector rotation or alternative assets for better diversification'}</span>
                        </li>
                      </ul>
                    </div>
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
