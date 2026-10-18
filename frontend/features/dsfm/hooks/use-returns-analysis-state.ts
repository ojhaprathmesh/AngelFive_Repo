import { useState } from "react";

import { POPULAR_STOCKS } from "../constants";
import { useADFTest } from "./use-adf-test";
import { useReturnsData } from "./use-returns-data";
import { useSentimentAnalysis } from "./use-sentiment-analysis";
import { useTimeSeriesModels } from "./use-time-series-models";

export function useReturnsAnalysisState() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    POPULAR_STOCKS[0] ?? "RELIANCE",
  );
  const [timeframe, setTimeframe] = useState<string>("1M");

  const returns = useReturnsData(selectedSymbol, timeframe);
  const adf = useADFTest(selectedSymbol, timeframe);
  const timeSeries = useTimeSeriesModels();
  const sentiment = useSentimentAnalysis();

  return {
    selectedSymbol,
    setSelectedSymbol,
    timeframe,
    setTimeframe,
    returns,
    adf,
    timeSeries,
    sentiment,
  };
}

export type ReturnsAnalysisState = ReturnType<typeof useReturnsAnalysisState>;
