import { useCallback, useRef, useState } from "react";

import type {
  ArimaResult,
  GarchResult,
  LSTMResult,
} from "@/features/dsfm/types";

import { pollJobResult } from "../utils/polling";

interface UseTimeSeriesModelsReturn {
  arimaResult: ArimaResult | null;
  garchResult: GarchResult | null;
  lstmResult: LSTMResult | null;
  loadingARIMA: boolean;
  loadingGARCH: boolean;
  loadingLSTM: boolean;
  arimaChartRef: React.RefObject<HTMLDivElement | null>;
  garchVolChartRef: React.RefObject<HTMLDivElement | null>;
  lstmChartRef: React.RefObject<HTMLDivElement | null>;
  runArima: (
    symbol: string,
    timeframe: string,
    order: [number, number, number],
  ) => Promise<void>;
  runGarch: (
    symbol: string,
    timeframe: string,
    order: [number, number],
  ) => Promise<void>;
  runLstm: (symbol: string, lookback: number, steps: number) => Promise<void>;
}

export function useTimeSeriesModels(): UseTimeSeriesModelsReturn {
  const [arimaResult, setArimaResult] = useState<ArimaResult | null>(null);
  const [garchResult, setGarchResult] = useState<GarchResult | null>(null);
  const [lstmResult, setLstmResult] = useState<LSTMResult | null>(null);
  const [loadingARIMA, setLoadingARIMA] = useState(false);
  const [loadingGARCH, setLoadingGARCH] = useState(false);
  const [loadingLSTM, setLoadingLSTM] = useState(false);

  const arimaChartRef = useRef<HTMLDivElement>(null);
  const garchVolChartRef = useRef<HTMLDivElement>(null);
  const lstmChartRef = useRef<HTMLDivElement>(null);

  const runArima = useCallback(
    async (
      symbol: string,
      timeframe: string,
      order: [number, number, number],
    ) => {
      setLoadingARIMA(true);
      setArimaResult(null);
      try {
        const arimaTimeframe = timeframe === "1M" ? "1Y" : timeframe;
        const resp = await fetch("/api/dsfm/arima", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, timeframe: arimaTimeframe, order }),
        });
        if (resp.ok) {
          const { jobId, queueName } = await resp.json();
          const data = await pollJobResult<ArimaResult>(queueName, jobId);
          setArimaResult(data);
        } else {
          const errorData = await resp
            .json()
            .catch(() => ({ error: `HTTP ${resp.status}` }));
          alert(
            `ARIMA Model Error: ${errorData.message || errorData.error || "Unknown error"}`,
          );
        }
      } catch (e: unknown) {
        alert(`ARIMA Model Error: ${(e as Error).message || "Network error"}`);
      } finally {
        setLoadingARIMA(false);
      }
    },
    [],
  );

  const runGarch = useCallback(
    async (symbol: string, timeframe: string, order: [number, number]) => {
      setLoadingGARCH(true);
      setGarchResult(null);
      try {
        const garchTimeframe = timeframe === "1M" ? "1Y" : timeframe;
        const resp = await fetch("/api/dsfm/garch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, timeframe: garchTimeframe, order }),
        });
        if (resp.ok) {
          const { jobId, queueName } = await resp.json();
          const data = await pollJobResult<GarchResult>(queueName, jobId);
          setGarchResult(data);
        } else {
          const errorData = await resp
            .json()
            .catch(() => ({ error: `HTTP ${resp.status}` }));
          alert(
            `GARCH Model Error: ${errorData.message || errorData.error || "Unknown error"}`,
          );
        }
      } catch (e: unknown) {
        alert(`GARCH Model Error: ${(e as Error).message || "Network error"}`);
      } finally {
        setLoadingGARCH(false);
      }
    },
    [],
  );

  const runLstm = useCallback(
    async (symbol: string, lookback: number, steps: number) => {
      setLoadingLSTM(true);
      setLstmResult(null);
      try {
        const resp = await fetch("/api/dsfm/lstm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol,
            timeframe: "1Y",
            lookback,
            forecastSteps: steps,
          }),
        });
        if (resp.ok) {
          const { jobId, queueName } = await resp.json();
          const data = await pollJobResult<LSTMResult>(queueName, jobId);
          setLstmResult(data);
        } else {
          const errorData = await resp
            .json()
            .catch(() => ({ error: `HTTP ${resp.status}` }));
          alert(
            `LSTM Error: ${errorData.error || errorData.message || "Unknown error"}`,
          );
        }
      } catch (e: unknown) {
        alert(`LSTM Error: ${(e as Error).message || "Network error"}`);
      } finally {
        setLoadingLSTM(false);
      }
    },
    [],
  );

  return {
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
  };
}
