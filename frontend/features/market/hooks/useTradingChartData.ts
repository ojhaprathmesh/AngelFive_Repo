import { format } from "date-fns";
import { UTCTimestamp } from "lightweight-charts";
import { useEffect, useState } from "react";

import { marketDataService } from "@/features/market/services/market-data";

import { IndexType } from "./useLiveIndexData";

export type TimeFrame = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y" | "Max";
export type ChartType = "Area" | "Candles";

export function useTradingChartData(
  selectedIndex: IndexType,
  timeFrame: TimeFrame,
  setTimeFrame: (tf: TimeFrame) => void,
) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartDataLoading, setChartDataLoading] = useState(true);
  const [chartDataEmpty, setChartDataEmpty] = useState(false);
  const [autoSwitchedFrom, setAutoSwitchedFrom] = useState<TimeFrame | null>(
    null,
  );

  // Clear auto-switch message when user changes index
  useEffect(() => {
    setAutoSwitchedFrom(null);
  }, [selectedIndex]);

  useEffect(() => {
    const map: Record<IndexType, string> = {
      SENSEX: "BSE:SENSEX",
      NIFTY: "NSE:NIFTY",
      BANKNIFTY: "NSE:BANKNIFTY",
      INDIAVIX: "NSE:INDIAVIX",
      FINNIFTY: "NSE:FINNIFTY",
    };

    setChartDataLoading(true);
    setChartDataEmpty(false);

    const run = async () => {
      try {
        const symbol = map[selectedIndex];
        const now = new Date();

        const fmtUTC = (d: Date) =>
          `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

        let fromDate: string;
        let toDate: string;
        let interval: string;

        if (timeFrame === "1D") {
          interval = "ONE_MINUTE";
          const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
          const nowIST = new Date(now.getTime() + IST_OFFSET_MS);

          const dow = nowIST.getUTCDay();
          const istH = nowIST.getUTCHours();
          const istM = nowIST.getUTCMinutes();
          const beforeOpen = istH < 9 || (istH === 9 && istM < 15);

          let daysBack = 0;
          if (dow === 0) daysBack = 2;
          else if (dow === 6) daysBack = 1;
          else if (beforeOpen && dow === 1) daysBack = 3;
          else if (beforeOpen) daysBack = 1;

          const tDay = new Date(nowIST);
          tDay.setUTCDate(tDay.getUTCDate() - daysBack);

          const fromUTC = new Date(
            Date.UTC(
              tDay.getUTCFullYear(),
              tDay.getUTCMonth(),
              tDay.getUTCDate(),
              3,
              45,
            ),
          );
          const toUTC = new Date(
            Date.UTC(
              tDay.getUTCFullYear(),
              tDay.getUTCMonth(),
              tDay.getUTCDate(),
              10,
              0,
            ),
          );

          fromDate = fmtUTC(fromUTC);
          toDate = fmtUTC(toUTC);
        } else {
          const from = new Date(now);
          toDate = format(now, "yyyy-MM-dd HH:mm");
          switch (timeFrame) {
            case "5D":
              interval = "THREE_MINUTE";
              from.setDate(now.getDate() - 5);
              break;
            case "1M":
              interval = "FIFTEEN_MINUTE";
              from.setMonth(now.getMonth() - 1);
              break;
            case "6M":
              interval = "ONE_DAY";
              from.setMonth(now.getMonth() - 6);
              break;
            case "1Y":
              interval = "ONE_DAY";
              from.setFullYear(now.getFullYear() - 1);
              break;
            case "5Y":
              interval = "ONE_DAY";
              from.setFullYear(now.getFullYear() - 5);
              break;
            case "Max":
              interval = "ONE_DAY";
              from.setFullYear(now.getFullYear() - 10);
              break;
            default:
              interval = "ONE_DAY";
              from.setFullYear(now.getFullYear() - 1);
          }
          fromDate = format(from, "yyyy-MM-dd HH:mm");
        }

        const tokenInfo = await marketDataService.getSymbolToken(symbol);
        if (!tokenInfo) {
          setChartDataEmpty(true);
          return;
        }

        let candles = await marketDataService.getCandleData(
          tokenInfo.exchange,
          tokenInfo.token,
          interval,
          fromDate,
          toDate,
        );

        if (timeFrame === "1D" && candles.length === 0) {
          candles = await marketDataService.getCandleData(
            tokenInfo.exchange,
            tokenInfo.token,
            "FIVE_MINUTE",
            fromDate,
            toDate,
          );
        }
        if (timeFrame === "1D" && candles.length === 0) {
          candles = await marketDataService.getCandleData(
            tokenInfo.exchange,
            tokenInfo.token,
            "FIFTEEN_MINUTE",
            fromDate,
            toDate,
          );
        }

        const mapped = candles.map((c) => ({
          time: Math.floor(new Date(c[0]).getTime() / 1000) as UTCTimestamp,
          value: c[4],
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
        }));

        const minPointsFor1D = 10;
        const isSparse1D =
          timeFrame === "1D" &&
          mapped.length > 0 &&
          mapped.length < minPointsFor1D;

        if (mapped.length === 0 || isSparse1D) {
          setChartDataEmpty(true);
          const tfList: TimeFrame[] = [
            "1D",
            "5D",
            "1M",
            "6M",
            "1Y",
            "5Y",
            "Max",
          ];
          const idx = tfList.indexOf(timeFrame);
          if (idx >= 0 && idx < tfList.length - 1) {
            setAutoSwitchedFrom(timeFrame);
            setTimeFrame(tfList[idx + 1]);
          }
        } else {
          setChartDataEmpty(false);
          setAutoSwitchedFrom(null);
          setChartData(mapped);
        }
      } catch {
        setChartDataEmpty(true);
      } finally {
        setChartDataLoading(false);
      }
    };

    void run();
  }, [selectedIndex, timeFrame, setTimeFrame]);

  return {
    chartData,
    chartDataLoading,
    chartDataEmpty,
    autoSwitchedFrom,
    setAutoSwitchedFrom,
  };
}
