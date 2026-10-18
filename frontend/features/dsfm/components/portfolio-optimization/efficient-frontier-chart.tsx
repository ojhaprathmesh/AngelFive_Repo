"use client";

import { useCallback, useEffect, useRef } from "react";

interface EfficientFrontierChartProps {
  frontier: Array<{ volatility: number; expected_return: number }>;
  optimal: { volatility: number; expected_return: number } | null | undefined;
  shouldRender: boolean;
}

export function EfficientFrontierChart({
  frontier,
  optimal,
  shouldRender,
}: EfficientFrontierChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderChart = useCallback(
    (
      f: Array<{ volatility: number; expected_return: number }>,
      opt: { volatility: number; expected_return: number } | null | undefined,
    ) => {
      if (!containerRef.current) return;
      if (!f || f.length === 0) return;
      if (containerRef.current.clientWidth === 0) {
        setTimeout(() => renderChart(f, opt), 200);
        return;
      }

      containerRef.current.innerHTML = "";

      const sortedFrontier = [...f].sort((a, b) => a.volatility - b.volatility);
      const validFrontier = sortedFrontier.filter(
        (p) =>
          p.volatility > 0 &&
          isFinite(p.volatility) &&
          isFinite(p.expected_return) &&
          !isNaN(p.volatility) &&
          !isNaN(p.expected_return),
      );
      if (validFrontier.length === 0) return;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "400");
      svg.setAttribute("viewBox", "0 0 800 400");
      svg.style.display = "block";

      const width = 800;
      const height = 400;
      const padding = 60;
      const allPoints = opt ? [...validFrontier, opt] : validFrontier;
      const minVol = Math.min(...allPoints.map((p) => p.volatility));
      const maxVol = Math.max(...allPoints.map((p) => p.volatility));
      const minRet = Math.min(...allPoints.map((p) => p.expected_return));
      const maxRet = Math.max(...allPoints.map((p) => p.expected_return));
      const volRange = maxVol - minVol || 0.01;
      const retRange = maxRet - minRet || 0.01;
      const xScale = (vol: number) =>
        padding + ((vol - minVol) / volRange) * (width - 2 * padding);
      const yScale = (ret: number) =>
        height - padding - ((ret - minRet) / retRange) * (height - 2 * padding);

      // Grid lines
      for (let i = 0; i <= 5; i++) {
        const x = padding + (i / 5) * (width - 2 * padding);
        const y = padding + (i / 5) * (height - 2 * padding);
        const vLine = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        vLine.setAttribute("x1", x.toString());
        vLine.setAttribute("y1", padding.toString());
        vLine.setAttribute("x2", x.toString());
        vLine.setAttribute("y2", (height - padding).toString());
        vLine.setAttribute("stroke", "#e5e7eb");
        vLine.setAttribute("stroke-width", "1");
        svg.appendChild(vLine);
        const hLine = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        hLine.setAttribute("x1", padding.toString());
        hLine.setAttribute("y1", y.toString());
        hLine.setAttribute("x2", (width - padding).toString());
        hLine.setAttribute("y2", y.toString());
        hLine.setAttribute("stroke", "#e5e7eb");
        hLine.setAttribute("stroke-width", "1");
        svg.appendChild(hLine);
      }

      // Frontier curve
      let pathData = "";
      validFrontier.forEach((p, idx) => {
        const x = xScale(p.volatility);
        const y = yScale(p.expected_return);
        pathData += idx === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `;
      });
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", pathData);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#3b82f6");
      path.setAttribute("stroke-width", "2");
      svg.appendChild(path);

      // Optimal portfolio point
      if (opt) {
        const optX = xScale(opt.volatility);
        const optY = yScale(opt.expected_return);
        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        circle.setAttribute("cx", optX.toString());
        circle.setAttribute("cy", optY.toString());
        circle.setAttribute("r", "10");
        circle.setAttribute("fill", "#10b981");
        circle.setAttribute("stroke", "#fff");
        circle.setAttribute("stroke-width", "3");
        svg.appendChild(circle);
        const label = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        label.setAttribute("x", (optX + 20).toString());
        label.setAttribute("y", (optY - 15).toString());
        label.setAttribute("fill", "#10b981");
        label.setAttribute("font-size", "11");
        label.setAttribute("font-weight", "bold");
        label.textContent = `Optimal (${(opt.expected_return * 100).toFixed(1)}%)`;
        svg.appendChild(label);
      }

      // Axis labels
      const xAxisLabel = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      xAxisLabel.setAttribute("x", (width / 2).toString());
      xAxisLabel.setAttribute("y", (height - 10).toString());
      xAxisLabel.setAttribute("text-anchor", "middle");
      xAxisLabel.setAttribute("fill", "#6b7280");
      xAxisLabel.setAttribute("font-size", "12");
      xAxisLabel.textContent = "Volatility (Risk) →";
      svg.appendChild(xAxisLabel);

      const yAxisLabel = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      yAxisLabel.setAttribute("x", "15");
      yAxisLabel.setAttribute("y", (height / 2).toString());
      yAxisLabel.setAttribute("text-anchor", "middle");
      yAxisLabel.setAttribute("fill", "#6b7280");
      yAxisLabel.setAttribute("font-size", "12");
      yAxisLabel.setAttribute("transform", `rotate(-90, 15, ${height / 2})`);
      yAxisLabel.textContent = "→ Expected Return (%)";
      svg.appendChild(yAxisLabel);

      // Tick labels
      for (let i = 0; i <= 5; i++) {
        const vol = minVol + (i / 5) * (maxVol - minVol);
        const ret = minRet + (i / 5) * (maxRet - minRet);
        const xTick = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        xTick.setAttribute("x", xScale(vol).toString());
        xTick.setAttribute("y", (height - padding + 20).toString());
        xTick.setAttribute("text-anchor", "middle");
        xTick.setAttribute("fill", "#6b7280");
        xTick.setAttribute("font-size", "10");
        xTick.textContent = `${(vol * 100).toFixed(1)}%`;
        svg.appendChild(xTick);
        const yTick = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        yTick.setAttribute("x", (padding - 10).toString());
        yTick.setAttribute("y", (yScale(ret) + 4).toString());
        yTick.setAttribute("text-anchor", "end");
        yTick.setAttribute("fill", "#6b7280");
        yTick.setAttribute("font-size", "10");
        yTick.textContent = `${(ret * 100).toFixed(1)}%`;
        svg.appendChild(yTick);
      }

      containerRef.current.appendChild(svg);
    },
    [],
  );

  useEffect(() => {
    if (!shouldRender || !frontier || frontier.length === 0) return;

    renderChart(frontier, optimal);

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          renderChart(frontier, optimal);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (container) container.innerHTML = "";
    };
  }, [frontier, optimal, shouldRender, renderChart]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border bg-white p-4 dark:bg-gray-900"
      style={{ height: "400px", minHeight: "400px" }}
    />
  );
}
