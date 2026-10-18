import { ChevronDown, Info } from "lucide-react";

const METRIC_EXPLANATIONS = [
  {
    title: "Mean Return (μ)",
    formula: "μ = (1/n) × Σ(log returns)",
    desc: "Average of all daily log returns. Shows expected daily return.",
  },
  {
    title: "Volatility (σ)",
    formula: "σ = √(Σ(returns - μ)² / n)",
    desc: "Standard deviation of returns. Measures risk/uncertainty. Higher = more volatile.",
  },
  {
    title: "Sharpe Ratio",
    formula: "Sharpe = (μ_annual - r_f) / σ_annual",
    desc: "Risk-adjusted return. Compares excess return to volatility. >1 is good, >2 is excellent.",
  },
  {
    title: "Range",
    formula: "[min(returns), max(returns)]",
    desc: "Minimum and maximum daily returns observed in the period.",
  },
];

export function MetricsExplainer() {
  return (
    <details className="group bg-card text-card-foreground rounded-lg border shadow-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center justify-between p-6 text-lg font-semibold transition-colors">
        How These Metrics Are Calculated
        <ChevronDown className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-3 border-t p-6 pt-0">
        <div className="space-y-2 pt-4">
          {METRIC_EXPLANATIONS.map(({ title, formula, desc }) => (
            <div key={title} className="flex items-start gap-2">
              <Info className="mt-0.5 h-5 w-5 text-blue-500" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Formula: {formula}
                </p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
