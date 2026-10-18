"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LSTMResult } from "@/features/dsfm/types";

interface LSTMTabProps {
  selectedSymbol: string;
  lstmResult: LSTMResult | null;
  loadingLSTM: boolean;
  lstmChartRef: React.RefObject<HTMLDivElement | null>;
  runLstm: (symbol: string, lookback: number, steps: number) => Promise<void>;
}

export function LSTMTab({
  selectedSymbol,
  lstmResult,
  loadingLSTM,
  lstmChartRef,
  runLstm,
}: LSTMTabProps) {
  const handleRun = () => {
    const lookback = parseInt(
      (document.getElementById("lstm-lookback") as HTMLInputElement)?.value ||
        "10",
    );
    const steps = parseInt(
      (document.getElementById("lstm-steps") as HTMLInputElement)?.value || "5",
    );
    void runLstm(selectedSymbol, lookback, steps);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>LSTM (Long Short-Term Memory) Forecasting</CardTitle>
        <CardDescription>
          Deep learning model for time series forecasting using recurrent neural
          networks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="lstm-lookback"
              className="text-xs text-gray-600 dark:text-gray-400"
            >
              Lookback Period
            </label>
            <input
              id="lstm-lookback"
              type="number"
              min="5"
              max="30"
              defaultValue="10"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="lstm-steps"
              className="text-xs text-gray-600 dark:text-gray-400"
            >
              Forecast Steps
            </label>
            <input
              id="lstm-steps"
              type="number"
              min="1"
              max="30"
              defaultValue="5"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
        <Button onClick={handleRun} disabled={loadingLSTM}>
          {loadingLSTM ? "Training Model..." : "Run LSTM Forecast"}
        </Button>
        {lstmResult && (
          <div className="mt-4 space-y-2 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="font-semibold text-blue-800 dark:text-blue-200">
              LSTM Forecast Results
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">RMSE:</span>
                <span className="ml-2 font-mono font-bold">
                  {lstmResult.rmse?.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  R² Score:
                </span>
                <span className="ml-2 font-mono font-bold">
                  {lstmResult.r2_score?.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Training Loss:
                </span>
                <span className="ml-2 font-mono font-bold">
                  {lstmResult.training_loss?.toFixed(4)}
                </span>
              </div>
            </div>
            {lstmResult.forecast && (
              <div className="mt-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Forecast:
                </p>
                <p className="font-mono text-xs">
                  {lstmResult.forecast
                    .map((f: number) => f.toFixed(4))
                    .join(", ")}
                </p>
                <div ref={lstmChartRef} className="mt-2 h-60 w-full" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
