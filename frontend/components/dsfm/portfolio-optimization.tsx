"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectItem, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Sensex 30 Stocks (Official BSE Sensex constituents)
const SENSEX_STOCKS = [
  "ADANIPORTS",    // ADANI PORTS & SEZ
  "ASIANPAINT",    // ASIAN PAINTS
  "AXISBANK",      // AXIS BANK
  "BAJFINANCE",    // BAJAJ FINANCE
  "BAJAJFINSV",    // BAJAJ FINSERV
  "BHARTIARTL",    // BHARTI AIRTEL
  "ETERNAL",       // ETERNAL LTD
  "HCLTECH",       // HCL TECHNOLOGIES
  "HDFCBANK",      // HDFC BANK
  "HINDUNILVR",    // HINDUSTAN UNILEVER
  "ICICIBANK",     // ICICI BANK
  "INDUSINDBK",    // INDUSIND BANK
  "INFY",          // INFOSYS
  "ITC",           // ITC
  "KOTAKBANK",     // KOTAK MAHINDRA BANK
  "MARUTI",        // MARUTI SUZUKI
  "NESTLEIND",     // NESTLE
  "NTPC",          // NTPC
  "POWERGRID",     // POWER GRID
  "RELIANCE",      // RELIANCE IND.
  "SBIN",          // SBI
  "SUNPHARMA",     // SUN PHARMA
  "TATAMOTORS",    // TATA MOTORS PASSENGER VEHICLES LIMITED
  "TATASTEEL",     // TATA STEEL
  "TCS",           // TCS
  "TECHM",         // TECH MAHINDRA
  "TITAN",         // TITAN
  "ULTRACEMCO"     // ULTRATECH CEMENT
];

// Nifty 50 Stocks (Official NSE Nifty 50 constituents)
const NIFTY_50_STOCKS = [
  "RELIANCE",      // Reliance Industries
  "HDFCBANK",      // HDFC Bank
  "BHARTIARTL",    // Bharti Airtel
  "TCS",           // TCS
  "ICICIBANK",     // ICICI Bank
  "SBIN",          // SBI
  "INFY",          // Infosys
  "BAJFINANCE",    // Bajaj Finance
  "HINDUNILVR",    // Hind. Unilever
  "HDFCLIFE",      // Life Insurance (HDFC Life)
  "LT",            // Larsen & Toubro
  "ITC",           // ITC
  "MARUTI",        // Maruti Suzuki
  "HCLTECH",       // HCL Technologies
  "SUNPHARMA",     // Sun Pharma.lnds.
  "KOTAKBANK",     // Kotak Mah. Bank
  "AXISBANK",      // Axis Bank
  "TITAN",         // Titan Company
  "ULTRACEMCO",    // UltraTech Cem.
  "BAJAJFINSV",    // Bajaj Finserv
  "ADANIPORTS",    // Adani Ports
  "NTPC",          // NTPC
  "ADANIENT",      // Adani Enterp.
  "ONGC",          // ONGC
  "HAL",           // Hind.Aeronautics
  "BEL",           // Bharat Electron
  "ETERNAL",       // Eternal Ltd
  "ADANIPOWER",    // Adani Power
  "JSWSTEEL",      // JSW Steel
  "ASIANPAINT",    // Asian Paints
  "DMART",         // Avenue Super. (DMart)
  "POWERGRID",     // Power Grid Corpn
  "WIPRO",         // Wipro
  "BAJAJ-AUTO",    // Bajaj Auto (Note: May need to check API symbol format)
  "NESTLEIND",     // Nestle India
  "IOC",           // IOCL
  "COALINDIA",     // Coal India
  "INDIGO",        // Interglobe Aviat (IndiGo)
  "TATASTEEL",     // Tata Steel
  "SBILIFE",       // SBI Life Insuran
  "EICHERMOT",     // Eicher Motors
  "VEDL",          // Vedanta
  "HINDZINC",      // Hindustan Zinc (Note: May need to check API symbol)
  "JIOFIN",        // Jio Financial
  "HYUNDAI",       // Hyundai Motor I (Note: May need to check API symbol)
  "GRASIM",        // Grasim Inds
  "DLF",           // DLF
  "LTIM",          // LTI Mindtree
  "HINDALCO"       // Hindalco Inds.
];

export function PortfolioOptimization() {
  const [selectedIndex, setSelectedIndex] = useState<string>("nifty50");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [loadingMPT, setLoadingMPT] = useState(false);
  const [loadingBL, setLoadingBL] = useState(false);
  const [mptResult, setMptResult] = useState<any>(null);
  const [blResult, setBlResult] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<string>("1Y");
  const efficientFrontierChartRef = useRef<HTMLDivElement>(null);

  // Update current stocks based on selected index
  const currentStocks = selectedIndex === "nifty50" ? NIFTY_50_STOCKS : SENSEX_STOCKS;

  // Clear selected symbols when index changes
  useEffect(() => {
    setSelectedSymbols([]);
    setMptResult(null);
    setBlResult(null);
  }, [selectedIndex]);

  const [activeTab, setActiveTab] = useState<string>("results");

  // Render efficient frontier chart when tab is active or data changes
  useEffect(() => {
    if (
      activeTab === "frontier" &&
      mptResult?.efficient_frontier && 
      mptResult.efficient_frontier.length > 0
    ) {
      // Small delay to ensure DOM is ready when tab switches
      const timer = setTimeout(() => {
        if (efficientFrontierChartRef.current) {
          console.log('Rendering efficient frontier, tab is active');
          renderEfficientFrontier(mptResult.efficient_frontier, mptResult.optimal_portfolio);
        } else {
          console.warn('Chart ref not available when trying to render');
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [mptResult, activeTab]);

  const handleSelectAll = () => {
    setSelectedSymbols([...currentStocks]);
  };

  const handleDeselectAll = () => {
    setSelectedSymbols([]);
  };

  const toggleSymbol = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const renderEfficientFrontier = (frontier: any[], optimal: any) => {
    if (!efficientFrontierChartRef.current) {
      console.warn('Efficient frontier ref not available');
      return;
    }
    
    if (!frontier || frontier.length === 0) {
      console.warn('Efficient frontier data is empty');
      return;
    }
    
    // Clear previous content
    efficientFrontierChartRef.current.innerHTML = '';
    
    // Wait for container to be visible
    if (efficientFrontierChartRef.current.clientWidth === 0) {
      console.log('Container not ready, retrying in 200ms...');
      setTimeout(() => renderEfficientFrontier(frontier, optimal), 200);
      return;
    }

    console.log('Rendering efficient frontier with', frontier.length, 'points');
    console.log('Optimal portfolio:', optimal);

    // Sort frontier by volatility for proper curve (already sorted from backend)
    const sortedFrontier = [...frontier].sort((a, b) => a.volatility - b.volatility);
    
    // Filter out any invalid points (negative volatility, NaN, etc.)
    const validFrontier = sortedFrontier.filter(p => 
      p.volatility > 0 && 
      isFinite(p.volatility) && 
      isFinite(p.expected_return) &&
      !isNaN(p.volatility) &&
      !isNaN(p.expected_return)
    );
    
    if (validFrontier.length === 0) {
      console.warn('No valid frontier points after filtering');
      return;
    }
    
    const sortedFrontierClean = validFrontier;

    // Create SVG chart for efficient frontier (better for scatter/line plots)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '400');
    svg.setAttribute('viewBox', '0 0 800 400');
    svg.style.display = 'block';

    const width = 800;
    const height = 400;
    const padding = 60;

    // Calculate scales - include optimal portfolio in range
    const allPoints = optimal ? [...sortedFrontierClean, optimal] : sortedFrontierClean;
    const minVol = Math.min(...allPoints.map(p => p.volatility));
    const maxVol = Math.max(...allPoints.map(p => p.volatility));
    const minRet = Math.min(...allPoints.map(p => p.expected_return));
    const maxRet = Math.max(...allPoints.map(p => p.expected_return));

    // Handle edge case where all values are the same
    const volRange = maxVol - minVol || 0.01;
    const retRange = maxRet - minRet || 0.01;

    const xScale = (vol: number) => padding + ((vol - minVol) / volRange) * (width - 2 * padding);
    const yScale = (ret: number) => height - padding - ((ret - minRet) / retRange) * (height - 2 * padding);

    // Draw grid lines
    for (let i = 0; i <= 5; i++) {
      const x = padding + (i / 5) * (width - 2 * padding);
      const y = padding + (i / 5) * (height - 2 * padding);
      
      // Vertical grid
      const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      vLine.setAttribute('x1', x.toString());
      vLine.setAttribute('y1', padding.toString());
      vLine.setAttribute('x2', x.toString());
      vLine.setAttribute('y2', (height - padding).toString());
      vLine.setAttribute('stroke', '#e5e7eb');
      vLine.setAttribute('stroke-width', '1');
      svg.appendChild(vLine);

      // Horizontal grid
      const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hLine.setAttribute('x1', padding.toString());
      hLine.setAttribute('y1', y.toString());
      hLine.setAttribute('x2', (width - padding).toString());
      hLine.setAttribute('y2', y.toString());
      hLine.setAttribute('stroke', '#e5e7eb');
      hLine.setAttribute('stroke-width', '1');
      svg.appendChild(hLine);
    }

    // Draw efficient frontier curve with smoothing
    // Use quadratic bezier curves for smoother appearance
    let pathData = '';
    for (let idx = 0; idx < sortedFrontierClean.length; idx++) {
      const p = sortedFrontierClean[idx];
      const x = xScale(p.volatility);
      const y = yScale(p.expected_return);
      
      if (idx === 0) {
        pathData += `M ${x} ${y} `;
      } else if (idx === sortedFrontierClean.length - 1) {
        // Last point - just line to
        pathData += `L ${x} ${y}`;
      } else {
        // Use smooth curve (quadratic bezier)
        const prevP = sortedFrontierClean[idx - 1];
        const nextP = sortedFrontierClean[idx + 1];
        const prevX = xScale(prevP.volatility);
        const prevY = yScale(prevP.expected_return);
        const nextX = xScale(nextP.volatility);
        const nextY = yScale(nextP.expected_return);
        
        // Control point for smooth curve
        const cpX = x;
        const cpY = y;
        
        // Use line for now (can switch to Q for bezier if needed)
        pathData += `L ${x} ${y} `;
      }
    }
    
    console.log('Frontier range:', {
      minVol: minVol,
      maxVol: maxVol,
      minRet: minRet,
      maxRet: maxRet,
      points: sortedFrontier.length
    });

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#3b82f6');
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);

    // Draw optimal portfolio point (always on top)
    if (optimal) {
      const optX = xScale(optimal.volatility);
      const optY = yScale(optimal.expected_return);
      
      console.log('Optimal portfolio point:', {
        x: optX,
        y: optY,
        vol: optimal.volatility,
        ret: optimal.expected_return
      });
      
      // Draw a larger, more visible circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', optX.toString());
      circle.setAttribute('cy', optY.toString());
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', '#10b981');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '3');
      svg.appendChild(circle);

      // Label for optimal point with return info
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (optX + 20).toString());
      label.setAttribute('y', (optY - 15).toString());
      label.setAttribute('fill', '#10b981');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', 'bold');
      label.textContent = `Optimal (${(optimal.expected_return * 100).toFixed(1)}%)`;
      svg.appendChild(label);
    }

    // Add axis labels
    const xAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xAxisLabel.setAttribute('x', (width / 2).toString());
    xAxisLabel.setAttribute('y', (height - 10).toString());
    xAxisLabel.setAttribute('text-anchor', 'middle');
    xAxisLabel.setAttribute('fill', '#6b7280');
    xAxisLabel.setAttribute('font-size', '12');
    xAxisLabel.textContent = 'Volatility (Risk) →';
    svg.appendChild(xAxisLabel);

    const yAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yAxisLabel.setAttribute('x', '15');
    yAxisLabel.setAttribute('y', (height / 2).toString());
    yAxisLabel.setAttribute('text-anchor', 'middle');
    yAxisLabel.setAttribute('fill', '#6b7280');
    yAxisLabel.setAttribute('font-size', '12');
    yAxisLabel.setAttribute('transform', `rotate(-90, 15, ${height / 2})`);
    yAxisLabel.textContent = '↑ Expected Return (%)';
    svg.appendChild(yAxisLabel);

    // Add tick labels
    for (let i = 0; i <= 5; i++) {
      const vol = minVol + (i / 5) * (maxVol - minVol);
      const ret = minRet + (i / 5) * (maxRet - minRet);
      
      // X-axis ticks
      const xTick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      xTick.setAttribute('x', xScale(vol).toString());
      xTick.setAttribute('y', (height - padding + 20).toString());
      xTick.setAttribute('text-anchor', 'middle');
      xTick.setAttribute('fill', '#6b7280');
      xTick.setAttribute('font-size', '10');
      xTick.textContent = `${(vol * 100).toFixed(1)}%`;
      svg.appendChild(xTick);

      // Y-axis ticks
      const yTick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yTick.setAttribute('x', (padding - 10).toString());
      yTick.setAttribute('y', (yScale(ret) + 4).toString());
      yTick.setAttribute('text-anchor', 'end');
      yTick.setAttribute('fill', '#6b7280');
      yTick.setAttribute('font-size', '10');
      yTick.textContent = `${(ret * 100).toFixed(1)}%`;
      svg.appendChild(yTick);
    }

    efficientFrontierChartRef.current.appendChild(svg);
    console.log('Efficient frontier chart rendered successfully');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Optimization</CardTitle>
          <CardDescription>
            Modern Portfolio Theory (MPT) and Black-Litterman model for optimal asset allocation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Index</label>
              <Select 
                value={selectedIndex} 
                onChange={(e) => {
                  setSelectedIndex(e.target.value);
                }}
              >
                <SelectValue />
                <SelectItem value="nifty50">Nifty 50 ({NIFTY_50_STOCKS.length} stocks)</SelectItem>
                <SelectItem value="sensex">Sensex ({SENSEX_STOCKS.length} stocks)</SelectItem>
              </Select>
            </div>
            <div>
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
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">
                Select Stocks from {selectedIndex === "nifty50" ? "Nifty 50" : "Sensex"} ({selectedSymbols.length} selected)
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {currentStocks.map((sym) => (
                  <Button
                    key={`${selectedIndex}-${sym}`}
                    variant={selectedSymbols.includes(sym) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSymbol(sym)}
                    className="text-xs"
                  >
                    {sym}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selected: {selectedSymbols.length > 0 ? selectedSymbols.slice(0, 10).join(', ') + (selectedSymbols.length > 10 ? ` ... (+${selectedSymbols.length - 10} more)` : '') : 'None'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={async () => {
                if (selectedSymbols.length < 2) {
                  alert('Please select at least 2 stocks for portfolio optimization');
                  return;
                }
                setLoadingMPT(true);
                setMptResult(null);
                try {
                  const resp = await fetch('/api/dsfm/mpt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: selectedSymbols, timeframe, riskFreeRate: 0.06 }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    setMptResult(data);
                  } else {
                    const errorData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
                    alert(`MPT Error: ${errorData.error || errorData.message || 'Unknown error'}`);
                  }
                } catch (e: any) {
                  alert(`MPT Error: ${e.message || 'Network error'}`);
                } finally {
                  setLoadingMPT(false);
                }
              }}
              disabled={loadingMPT || selectedSymbols.length < 2}
            >
              {loadingMPT ? 'Optimizing...' : 'MPT Optimization'}
            </Button>
            <Button 
              onClick={async () => {
                if (selectedSymbols.length < 2) {
                  alert('Please select at least 2 stocks for portfolio optimization');
                  return;
                }
                setLoadingBL(true);
                setBlResult(null);
                try {
                  const resp = await fetch('/api/dsfm/black-litterman', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: selectedSymbols, timeframe, riskAversion: 3.0, tau: 0.05 }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    setBlResult(data);
                  } else {
                    const errorData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
                    alert(`Black-Litterman Error: ${errorData.error || errorData.message || 'Unknown error'}`);
                  }
                } catch (e: any) {
                  alert(`Black-Litterman Error: ${e.message || 'Network error'}`);
                } finally {
                  setLoadingBL(false);
                }
              }}
              disabled={loadingBL || selectedSymbols.length < 2}
              variant="outline"
            >
              {loadingBL ? 'Optimizing...' : 'Black-Litterman'}
            </Button>
          </div>

          {loadingMPT || loadingBL ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="results">Portfolio Results</TabsTrigger>
                <TabsTrigger value="frontier">Efficient Frontier</TabsTrigger>
              </TabsList>

              <TabsContent value="results" className="space-y-4">
                {mptResult && (
                  <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                    <CardHeader>
                      <CardTitle className="text-blue-800 dark:text-blue-200">MPT Optimal Portfolio</CardTitle>
                      <CardDescription className="text-blue-700 dark:text-blue-300">
                        <strong>Modern Portfolio Theory (MPT):</strong> Optimizes portfolio weights to maximize return for a given level of risk. 
                        The efficient frontier shows all optimal portfolios - higher risk portfolios offer higher expected returns. 
                        The optimal portfolio is the one with the highest Sharpe ratio (risk-adjusted return).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Expected Return:</span>
                          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                            {(mptResult.optimal_portfolio?.expected_return * 100)?.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Volatility:</span>
                          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                            {(mptResult.optimal_portfolio?.volatility * 100)?.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Sharpe Ratio:</span>
                          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                            {mptResult.optimal_portfolio?.sharpe_ratio?.toFixed(3)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-semibold mb-2">Optimal Weights:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                          {mptResult.symbols?.map((sym: string, idx: number) => {
                            const weight = (mptResult.optimal_portfolio?.weights[idx] * 100) || 0;
                            if (weight < 0.1) return null; // Skip very small weights
                            return (
                              <div key={sym} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded text-xs">
                                <span className="font-medium">{sym}:</span>
                                <Badge variant="secondary" className="font-mono">{weight.toFixed(1)}%</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {blResult && (
                  <Card className="border-purple-200 bg-purple-50 dark:bg-purple-900/20">
                    <CardHeader>
                      <CardTitle className="text-purple-800 dark:text-purple-200">Black-Litterman Optimal Portfolio</CardTitle>
                      <CardDescription className="text-purple-700 dark:text-purple-300">
                        <strong>Black-Litterman Model:</strong> Combines market equilibrium returns (from market cap weights) with investor views. 
                        More stable than pure MPT, reduces extreme weights, and allows incorporating expert opinions. 
                        Uses Bayesian approach to blend prior beliefs (market) with new information (views).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Expected Return:</span>
                          <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                            {(blResult.expected_return * 100)?.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Volatility:</span>
                          <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                            {(blResult.volatility * 100)?.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Sharpe Ratio:</span>
                          <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                            {blResult.sharpe_ratio?.toFixed(3)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-semibold mb-2">Optimal Weights:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                          {blResult.symbols?.map((sym: string, idx: number) => {
                            const weight = (blResult.optimal_weights[idx] * 100) || 0;
                            if (weight < 0.1) return null; // Skip very small weights
                            return (
                              <div key={sym} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded text-xs">
                                <span className="font-medium">{sym}:</span>
                                <Badge variant="secondary" className="font-mono">{weight.toFixed(1)}%</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="frontier" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Efficient Frontier</CardTitle>
                    <CardDescription>
                      Risk-Return trade-off curve showing optimal portfolios at different risk levels
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {mptResult?.efficient_frontier && mptResult.efficient_frontier.length > 0 ? (
                      <div 
                        ref={efficientFrontierChartRef} 
                        className="w-full border rounded-lg bg-white dark:bg-gray-900 p-4" 
                        style={{ height: "400px", minHeight: "400px" }}
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {mptResult ? 'No efficient frontier data available' : 'Run MPT Optimization first to see the Efficient Frontier'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
