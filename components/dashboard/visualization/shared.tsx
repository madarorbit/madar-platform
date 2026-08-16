'use client';

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { formatVisualizationValue, visualizationOutcomeLabels } from "./formatters";
import type {
  VisualizationDatum,
  VisualizationFillPattern,
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

export const VISUALIZATION_FILL_PATTERNS: VisualizationFillPattern[] = [
  "solid",
  "diagonal",
  "crosshatch",
  "dots",
  "horizontal",
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

export function resolveFillPattern(pattern: VisualizationFillPattern | undefined, index = 0): VisualizationFillPattern {
  return pattern ?? VISUALIZATION_FILL_PATTERNS[index % VISUALIZATION_FILL_PATTERNS.length];
}

export function useVisualizationPatternPrefix(scope: string) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return `md-viz-${scope}-${id}`;
}

function visualizationPatternId(prefix: string, index: number) {
  return `${prefix}-pattern-${index}`;
}

export function getVisualizationPatternFill(
  prefix: string,
  index: number,
  pattern: VisualizationFillPattern,
  color: string,
) {
  return pattern === "solid" ? color : `url(#${visualizationPatternId(prefix, index)})`;
}

function renderPatternMarks(pattern: VisualizationFillPattern) {
  const contrast = "var(--md-text-primary)";
  if (pattern === "diagonal") {
    return <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" stroke={contrast} strokeOpacity={0.32} strokeWidth={1.5} />;
  }
  if (pattern === "crosshatch") {
    return (
      <>
        <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" stroke={contrast} strokeOpacity={0.3} strokeWidth={1.2} />
        <path d="M-2 6 L2 10 M0 0 L8 8 M6 -2 L10 2" stroke={contrast} strokeOpacity={0.3} strokeWidth={1.2} />
      </>
    );
  }
  if (pattern === "dots") {
    return (
      <>
        <circle cx={2} cy={2} r={1.15} fill={contrast} fillOpacity={0.34} />
        <circle cx={6} cy={6} r={1.15} fill={contrast} fillOpacity={0.34} />
      </>
    );
  }
  if (pattern === "horizontal") {
    return <path d="M0 2 H8 M0 6 H8" stroke={contrast} strokeOpacity={0.3} strokeWidth={1.25} />;
  }
  return null;
}

export function renderVisualizationFillPatternDefs(
  prefix: string,
  entries: Array<{ color: string; pattern: VisualizationFillPattern }>,
) {
  return (
    <defs>
      {entries.map((entry, index) =>
        entry.pattern === "solid" ? null : (
          <pattern
            id={visualizationPatternId(prefix, index)}
            key={visualizationPatternId(prefix, index)}
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
          >
            <rect width={8} height={8} fill={entry.color} />
            {renderPatternMarks(entry.pattern)}
          </pattern>
        ),
      )}
    </defs>
  );
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

function VisualizationPatternSwatch({
  color,
  pattern,
}: {
  color: string;
  pattern: VisualizationFillPattern;
}) {
  const prefix = useVisualizationPatternPrefix("legend");
  return (
    <svg className="md-viz-legend-swatch-svg" viewBox="0 0 14 14" aria-hidden="true">
      {renderVisualizationFillPatternDefs(prefix, [{ color, pattern }])}
      <rect
        x={1}
        y={1}
        width={12}
        height={12}
        rx={2}
        fill={getVisualizationPatternFill(prefix, 0, pattern, color)}
        stroke="var(--md-border-strong)"
      />
    </svg>
  );
}

export function VisualizationCategoryLegend({
  entries,
}: {
  entries: Array<{ key: string; label: string; color: string; pattern?: VisualizationFillPattern }>;
}) {
  if (entries.length <= 1) return null;
  return (
    <ul className="md-viz-legend md-viz-legend-categories" aria-label="مفتاح فئات الرسم" dir="rtl">
      {entries.map((entry, index) => {
        const pattern = resolveFillPattern(entry.pattern, index);
        return (
          <li key={entry.key}>
            <VisualizationPatternSwatch color={entry.color} pattern={pattern} />
            <span>{entry.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

const visualizationOutcomeMarks: Record<VisualizationOutcome, string> = {
  favorable: "✓",
  unfavorable: "!",
  neutral: "=",
  unknown: "?",
};

export function VisualizationOutcomeIndicator({ outcome }: { outcome: VisualizationOutcome }) {
  return (
    <span className="md-viz-outcome-indicator" data-outcome={outcome}>
      <span className="md-viz-outcome-indicator-mark" aria-hidden="true">{visualizationOutcomeMarks[outcome]}</span>
      <span>{visualizationOutcomeLabels[outcome]}</span>
    </span>
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
