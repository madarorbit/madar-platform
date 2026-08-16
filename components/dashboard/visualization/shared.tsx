'use client';

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { formatVisualizationValue, visualizationOutcomeLabels } from "./formatters";
import type {
  VisualizationDatum,
  VisualizationOutcome,
  VisualizationSeriesDefinition,
  VisualizationSeriesRole,
  VisualizationSeriesToken,
  VisualizationValueFormat,
} from "./types";

export const VISUALIZATION_SERIES_TOKENS: VisualizationSeriesToken[] = [
  "series-1",
  "series-2",
  "series-3",
  "series-4",
  "series-5",
];

const seriesColorMap: Record<VisualizationSeriesToken, string> = {
  "series-1": "var(--md-viz-series-1)",
  "series-2": "var(--md-viz-series-2)",
  "series-3": "var(--md-viz-series-3)",
  "series-4": "var(--md-viz-series-4)",
  "series-5": "var(--md-viz-series-5)",
};

const dashPatterns = [undefined, "7 4", "2 4", "10 3 2 3", "4 3"] as const;

export function resolveSeriesColor(token: VisualizationSeriesToken | undefined, index = 0): string {
  return seriesColorMap[token ?? VISUALIZATION_SERIES_TOKENS[index % VISUALIZATION_SERIES_TOKENS.length]];
}

export function getSeriesStrokeDasharray(index: number, role: VisualizationSeriesRole = "actual") {
  if (role === "reference") return "7 4";
  return dashPatterns[index % dashPatterns.length];
}

export function useReducedVisualizationMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function useMobileVisualization() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

export function hasMeaningfulSeriesData(data: VisualizationDatum[], series: VisualizationSeriesDefinition[]) {
  return data.some((datum) =>
    series.some((item) => typeof datum[item.key] === "number" && Number.isFinite(datum[item.key] as number)),
  );
}

export function VisualizationFrame({
  ariaLabel,
  summary,
  children,
  className = "",
  showTextAlternative = true,
}: {
  ariaLabel: string;
  summary: string;
  children: ReactNode;
  className?: string;
  showTextAlternative?: boolean;
}) {
  return (
    <figure className={`md-viz-frame ${className}`.trim()} aria-label={ariaLabel} dir="rtl">
      <figcaption className="md-viz-sr-only">{summary}</figcaption>
      <div className="md-viz-canvas">{children}</div>
      {showTextAlternative ? (
        <details className="md-viz-text-alternative">
          <summary>ملخص نصي للبيانات</summary>
          <p>{summary}</p>
        </details>
      ) : null}
    </figure>
  );
}

export type VisualizationTooltipItem = {
  key: string;
  label: string;
  value: number | null;
  color: string;
  format?: VisualizationValueFormat;
  outcome?: VisualizationOutcome;
  role?: VisualizationSeriesRole;
};

export function VisualizationTooltip({
  active,
  label,
  items,
  context,
}: {
  active?: boolean;
  label?: ReactNode;
  items: VisualizationTooltipItem[];
  context?: string;
}) {
  if (!active || !items.length) return null;
  return (
    <div className="md-viz-tooltip" role="status" aria-live="polite" dir="rtl">
      {label ? <strong className="md-viz-tooltip-label">{label}</strong> : null}
      <div className="md-viz-tooltip-items">
        {items.map((item) => (
          <div className="md-viz-tooltip-item" key={item.key}>
            <span
              className="md-viz-tooltip-marker"
              style={{ "--md-viz-item-color": item.color } as CSSProperties}
              aria-hidden="true"
            />
            <span className="md-viz-tooltip-name">
              {item.label}
              {item.role === "reference" ? <small>مرجع</small> : null}
            </span>
            <bdi className="md-viz-tooltip-value" dir="ltr">
              {formatVisualizationValue(item.value, item.format)}
            </bdi>
            {item.outcome ? (
              <span className="md-viz-outcome" data-outcome={item.outcome}>
                {visualizationOutcomeLabels[item.outcome]}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {context ? <p className="md-viz-tooltip-context">{context}</p> : null}
    </div>
  );
}

export function VisualizationLegend({
  series,
}: {
  series: VisualizationSeriesDefinition[];
}) {
  if (series.length <= 1) return null;
  return (
    <ul className="md-viz-legend" aria-label="مفتاح سلاسل الرسم" dir="rtl">
      {series.map((item, index) => {
        const color = resolveSeriesColor(item.color, index);
        const dash = getSeriesStrokeDasharray(index, item.role);
        return (
          <li key={item.key}>
            <svg className="md-viz-legend-line" viewBox="0 0 28 8" aria-hidden="true" style={{ color }}>
              <line x1="1" x2="27" y1="4" y2="4" stroke="currentColor" strokeWidth="2.25" strokeDasharray={dash} />
            </svg>
            <span>{item.label}</span>
            {item.role === "reference" ? <small>مرجع</small> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function VisualizationCategoryLegend({
  entries,
}: {
  entries: Array<{ key: string; label: string; color: string }>;
}) {
  if (entries.length <= 1) return null;
  return (
    <ul className="md-viz-legend md-viz-legend-categories" aria-label="مفتاح فئات الرسم" dir="rtl">
      {entries.map((entry) => (
        <li key={entry.key}>
          <span className="md-viz-legend-swatch" style={{ background: entry.color }} aria-hidden="true" />
          <span>{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function VisualizationGuidance({ children }: { children: ReactNode }) {
  return <div className="md-viz-guidance" role="note">{children}</div>;
}

export function getDatumTooltipContext(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const context = (payload as { tooltipContext?: unknown }).tooltipContext;
  return typeof context === "string" ? context : undefined;
}

export function numericTooltipValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function wrapArabicLabel(value: string, maxChars: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [value];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function ArabicCategoryTick({
  x = 0,
  y = 0,
  payload,
  maxChars = 20,
}: {
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  maxChars?: number;
}) {
  const lines = wrapArabicLabel(String(payload?.value ?? ""), maxChars);
  return (
    <g transform={`translate(${x},${y})`}>
      <text className="md-viz-axis-text" x={8} y={0} textAnchor="start" direction="rtl">
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={8} dy={index === 0 ? 0 : 15}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}
