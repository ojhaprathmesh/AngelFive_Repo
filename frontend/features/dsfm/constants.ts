export const POPULAR_STOCKS = [
  "RELIANCE",
  "TCS",
  "HDFCBANK",
  "INFY",
  "ICICIBANK",
  "HINDUNILVR",
  "SBIN",
  "BHARTIARTL",
  "ITC",
  "KOTAKBANK",
  "LT",
  "AXISBANK",
  "ASIANPAINT",
  "MARUTI",
  "TITAN",
  "ULTRACEMCO",
  "NESTLEIND",
  "BAJFINANCE",
  "WIPRO",
  "ONGC",
  "TATAMOTORS",
  "NTPC",
  "POWERGRID",
  "INDUSINDBK",
  "TECHM",
  "HCLTECH",
  "SUNPHARMA",
  "COALINDIA",
] as const;

export type PopularStockSymbol = (typeof POPULAR_STOCKS)[number];

export interface TimeframeOption {
  value: string;
  label: string;
}

export interface TimeframeGroup {
  label: string;
  options: TimeframeOption[];
}

export const TIMEFRAME_GROUPS: TimeframeGroup[] = [
  {
    label: "Short term",
    options: [
      { value: "1W", label: "1 Week" },
      { value: "1M", label: "1 Month" },
      { value: "3M", label: "3 Months" },
    ],
  },
  {
    label: "Long term",
    options: [
      { value: "6M", label: "6 Months" },
      { value: "1Y", label: "1 Year" },
      { value: "2Y", label: "2 Years" },
      { value: "3Y", label: "3 Years" },
      { value: "5Y", label: "5 Years" },
    ],
  },
];
