"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { ArimaResult, GarchResult } from "@/features/dsfm/types";

interface ModelsTabProps {
  selectedSymbol: string;
  timeframe: string;
  arimaResult: ArimaResult | null;
  garchResult: GarchResult | null;
  loadingARIMA: boolean;
  loadingGARCH: boolean;
  arimaChartRef: React.RefObject<HTMLDivElement | null>;
  garchVolChartRef: React.RefObject<HTMLDivElement | null>;
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
}

export function ModelsTab({
  selectedSymbol,
  timeframe,
  arimaResult,
  garchResult,
  loadingARIMA,
  loadingGARCH,
  arimaChartRef,
  garchVolChartRef,
  runArima,
  runGarch,
}: ModelsTabProps) {
  const handleRunArima = () => {
    const p = parseInt(
      (document.getElementById("ar-order") as HTMLInputElement)?.value || "1",
    );
    const d = parseInt(
      (document.getElementById("diff-order") as HTMLInputElement)?.value || "0",
    );
    const q = parseInt(
      (document.getElementById("ma-order") as HTMLInputElement)?.value || "1",
    );
    void runArima(selectedSymbol, timeframe, [p, d, q]);
  };

  const handleRunGarch = () => {
    const p = parseInt(
      (document.getElementById("garch-p") as HTMLInputElement)?.value || "1",
    );
    const q = parseInt(
      (document.getElementById("garch-q") as HTMLInputElement)?.value || "1",
    );
    void runGarch(selectedSymbol, timeframe, [p, q]);
  };

  return (
    <div className="space-y-4">
      {/* ARIMA Card */}
      <Card>
        <CardHeader>
          <CardTitle>AR/MA/ARIMA Models</CardTitle>
          <CardDescription>
            Autoregressive (AR), Moving Average (MA), and ARIMA models for
            time-series forecasting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldSet>
            <FieldLegend variant="label">ARIMA Parameters</FieldLegend>
            <div className="grid grid-cols-3 gap-2">
              <Field>
                <FieldLabel htmlFor="ar-order">AR order (p)</FieldLabel>
                <input
                  id="ar-order"
                  type="number"
                  aria-label="AR Order"
                  min="0"
                  max="5"
                  defaultValue="1"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="diff-order">Differencing (d)</FieldLabel>
                <input
                  id="diff-order"
                  type="number"
                  aria-label="Diff Order"
                  min="0"
                  max="2"
                  defaultValue="0"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ma-order">MA order (q)</FieldLabel>
                <input
                  id="ma-order"
                  type="number"
                  aria-label="MA Order"
                  min="0"
                  max="5"
                  defaultValue="1"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </Field>
            </div>
          </FieldSet>
          <Button onClick={handleRunArima} disabled={loadingARIMA}>
            {loadingARIMA ? "Fitting Model..." : "Fit ARIMA Model"}
          </Button>
          {arimaResult && (
            <div className="mt-4 space-y-2 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <p className="font-semibold text-green-800 dark:text-green-200">
                ARIMA Model Results
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">AIC:</span>
                  <span className="ml-2 font-mono font-bold">
                    {arimaResult.aic?.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">BIC:</span>
                  <span className="ml-2 font-mono font-bold">
                    {arimaResult.bic?.toFixed(2)}
                  </span>
                </div>
              </div>
              {arimaResult.forecast && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    5-Step Forecast:
                  </p>
                  <p className="font-mono text-xs">
                    {arimaResult.forecast
                      .map((f: number) => f.toFixed(4))
                      .join(", ")}
                  </p>
                  <div ref={arimaChartRef} className="mt-2 h-60 w-full" />
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500">
            ARIMA(p,d,q): p=autoregressive terms, d=differencing, q=moving
            average terms. Note: Using 1Y timeframe for ARIMA models to ensure
            sufficient data (minimum 30 candles required).
          </p>
        </CardContent>
      </Card>

      {/* GARCH Card */}
      <Card>
        <CardHeader>
          <CardTitle>ARCH/GARCH Models</CardTitle>
          <CardDescription>
            Autoregressive Conditional Heteroskedasticity models for volatility
            clustering
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldSet>
            <FieldLegend variant="label">GARCH Parameters</FieldLegend>
            <div className="grid grid-cols-2 gap-2">
              <Field>
                <FieldLabel htmlFor="garch-p">GARCH p (ARCH terms)</FieldLabel>
                <input
                  id="garch-p"
                  type="number"
                  aria-label="GARCH p variable"
                  min="1"
                  max="3"
                  defaultValue="1"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="garch-q">GARCH q (GARCH terms)</FieldLabel>
                <input
                  id="garch-q"
                  type="number"
                  aria-label="GARCH q variable"
                  min="1"
                  max="3"
                  defaultValue="1"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </Field>
            </div>
          </FieldSet>
          <Button onClick={handleRunGarch} disabled={loadingGARCH}>
            {loadingGARCH ? "Fitting Model..." : "Fit GARCH Model"}
          </Button>
          {garchResult && (
            <div className="mt-4 space-y-2 rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
              <p className="font-semibold text-purple-800 dark:text-purple-200">
                GARCH Model Results
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">AIC:</span>
                  <span className="ml-2 font-mono font-bold">
                    {garchResult.aic?.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">BIC:</span>
                  <span className="ml-2 font-mono font-bold">
                    {garchResult.bic?.toFixed(2)}
                  </span>
                </div>
              </div>
              {garchResult.forecast && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Volatility Forecast (5 steps):
                  </p>
                  <p className="font-mono text-xs">
                    {garchResult.forecast
                      .map((f: number) => f.toFixed(4))
                      .join(", ")}
                  </p>
                  <div ref={garchVolChartRef} className="mt-2 h-60 w-full" />
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500">
            GARCH(p,q): Models volatility clustering. p=ARCH terms, q=GARCH
            terms. Note: Using 1Y timeframe for GARCH models to ensure
            sufficient data (minimum 50 candles required).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
