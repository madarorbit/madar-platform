import type { VisualizationOutcome, VisualizationValueFormat } from "./types";

const DEFAULT_LOCALE = "ar";
const DEFAULT_NUMBERING_SYSTEM = "latn";

export function formatVisualizationValue(
  value: number | null | undefined,
  format: VisualizationValueFormat = {},
): string {
  if (value == null || !Number.isFinite(value)) return "—";

  const locale = format.locale ?? DEFAULT_LOCALE;
  const numberingSystem = format.numberingSystem ?? DEFAULT_NUMBERING_SYSTEM;
  const options: Intl.NumberFormatOptions = {
    numberingSystem,
    minimumFractionDigits: format.minimumFractionDigits,
    maximumFractionDigits: format.maximumFractionDigits ?? (format.style === "compact" ? 1 : 2),
  };

  if (format.style === "compact") options.notation = "compact";
  if (format.style === "percent") options.style = "percent";
  if (format.style === "currency" && format.currency) {
    options.style = "currency";
    options.currency = format.currency;
    options.currencyDisplay = "symbol";
  }

  const rendered = new Intl.NumberFormat(locale, options).format(value);
  return format.unit ? `${rendered} ${format.unit}` : rendered;
}

export function formatVisualizationDate(
  value: string | number | Date,
  granularity: "day" | "month" | "date-time" = "day",
  locale = DEFAULT_LOCALE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const base: Intl.DateTimeFormatOptions = { numberingSystem: DEFAULT_NUMBERING_SYSTEM };
  if (granularity === "month") {
    Object.assign(base, { month: "short", year: "numeric" });
  } else if (granularity === "date-time") {
    Object.assign(base, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } else {
    Object.assign(base, { day: "numeric", month: "short" });
  }
  return new Intl.DateTimeFormat(locale, base).format(date);
}

export const visualizationOutcomeLabels: Record<VisualizationOutcome, string> = {
  favorable: "نتيجة مواتية",
  unfavorable: "نتيجة غير مواتية",
  neutral: "نتيجة محايدة",
  unknown: "المعنى غير محدد",
};
