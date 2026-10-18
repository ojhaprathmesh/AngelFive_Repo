"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReturnsAnalysisState } from "@/features/dsfm/hooks/use-returns-analysis-state";

import {
  MetricsExplainer,
  ReturnsErrorState,
  ReturnsStatsGrid,
  SymbolTimeframeSelector,
} from "./components";
import { ChartsTab } from "./tabs/charts-tab";
import { LSTMTab } from "./tabs/lstm-tab";
import { ModelsTab } from "./tabs/models-tab";
import { SentimentTab } from "./tabs/sentiment-tab";
import { StationarityTab } from "./tabs/stationarity-tab";

export function ReturnsAnalysis() {
  const {
    selectedSymbol,
    setSelectedSymbol,
    timeframe,
    setTimeframe,
    returns,
    adf,
    timeSeries,
    sentiment,
  } = useReturnsAnalysisState();

  const {
    data: returnsData,
    loading,
    error,
    priceChartRef,
    returnsChartRef,
  } = returns;

  const { adfResult, loadingADF } = adf;

  const {
    arimaResult,
    garchResult,
    lstmResult,
    loadingARIMA,
    loadingGARCH,
    loadingLSTM,
    arimaChartRef,
    garchVolChartRef,
    lstmChartRef,
    runArima,
    runGarch,
    runLstm,
  } = timeSeries;

  const {
    sentimentText,
    setSentimentText,
    finbertResult,
    ruleSentimentResult,
    loadingFinBERT,
    loadingRuleSentiment,
    runFinBERT,
    runRuleSentiment,
  } = sentiment;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Returns Analysis &amp; Time-Series Modeling</CardTitle>
          <CardDescription>
            Analyze log returns, distribution properties, statistical measures,
            and time-series models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SymbolTimeframeSelector
            selectedSymbol={selectedSymbol}
            onSymbolChange={setSelectedSymbol}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : returnsData ? (
            <>
              <ReturnsStatsGrid returnsData={returnsData} />

              {returnsData.calculations && <MetricsExplainer />}

              <Tabs defaultValue="charts" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="charts">Charts</TabsTrigger>
                  <TabsTrigger value="stationarity">ADF Test</TabsTrigger>
                  <TabsTrigger value="models">ARIMA/GARCH</TabsTrigger>
                  <TabsTrigger value="lstm">LSTM</TabsTrigger>
                  <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
                </TabsList>

                <TabsContent value="charts" className="space-y-4">
                  <ChartsTab
                    data={returnsData}
                    priceChartRef={priceChartRef}
                    returnsChartRef={returnsChartRef}
                  />
                </TabsContent>

                <TabsContent value="stationarity" className="space-y-4">
                  <StationarityTab
                    adfResult={adfResult}
                    loadingADF={loadingADF}
                  />
                </TabsContent>

                <TabsContent value="models" className="space-y-4">
                  <ModelsTab
                    selectedSymbol={selectedSymbol}
                    timeframe={timeframe}
                    arimaResult={arimaResult}
                    garchResult={garchResult}
                    loadingARIMA={loadingARIMA}
                    loadingGARCH={loadingGARCH}
                    arimaChartRef={arimaChartRef}
                    garchVolChartRef={garchVolChartRef}
                    runArima={runArima}
                    runGarch={runGarch}
                  />
                </TabsContent>

                <TabsContent value="lstm" className="space-y-4">
                  <LSTMTab
                    selectedSymbol={selectedSymbol}
                    lstmResult={lstmResult}
                    loadingLSTM={loadingLSTM}
                    lstmChartRef={lstmChartRef}
                    runLstm={runLstm}
                  />
                </TabsContent>

                <TabsContent value="sentiment" className="space-y-4">
                  <SentimentTab
                    sentimentText={sentimentText}
                    setSentimentText={setSentimentText}
                    finbertResult={finbertResult}
                    ruleSentimentResult={ruleSentimentResult}
                    loadingFinBERT={loadingFinBERT}
                    loadingRuleSentiment={loadingRuleSentiment}
                    runFinBERT={runFinBERT}
                    runRuleSentiment={runRuleSentiment}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : !loading ? (
            <div className="py-8 text-center">
              <ReturnsErrorState
                error={error}
                selectedSymbol={selectedSymbol}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
