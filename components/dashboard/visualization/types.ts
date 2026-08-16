export type VisualizationOutcome = "favorable" | "unfavorable" | "neutral" | "unknown";

export type VisualizationSeriesToken =
  | "series-1"
  | "series-2"
  | "series-3"
  | "series-4"
  | "series-5";

export type VisualizationSeriesRole = "actual" | "reference";

export type VisualizationValueFormat = {
  style?: "number" | "compact" | "percent" | "currency";
  currency?: string;
  unit?: string;
  locale?: string;
  numberingSystem?: "latn" | "arab";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export type VisualizationDatum = {
  label: string;
  tooltipContext?: string;
  [key: string]: string | number | null | undefined;
};

export type VisualizationSeriesDefinition = {
  key: string;
  label: string;
  color?: VisualizationSeriesToken;
  role?: VisualizationSeriesRole;
  outcome?: VisualizationOutcome;
  format?: VisualizationValueFormat;
};

export type VisualizationReference = {
  value: number;
  label: string;
  kind: "target" | "benchmark";
  format?: VisualizationValueFormat;
};

export type VisualizationPartialRange = {
  fromLabel: string;
  toLabel: string;
  label?: string;
};

export type VisualizationOrientation = "auto" | "horizontal" | "vertical";

export type CompositionDatum = {
  label: string;
  value: number;
  color?: VisualizationSeriesToken;
};
