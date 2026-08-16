'use client';

import type { CSSProperties } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardEmptyState } from "@/components/dashboard/Dashboard";
import { formatVisualizationValue } from "./formatters";
import {
  ArabicCategoryTick,
  getDatumTooltipContext,
  getSeriesStrokeDasharray,
  hasMeaningfulSeriesData,
  numericTooltipValue,
  resolveSeriesColor,
  useMobileVisualization,
  useReducedVisualizationMotion,
  VISUALIZATION_SERIES_TOKENS,
  VisualizationCategoryLegend,
  VisualizationFrame,
  VisualizationGuidance,
  VisualizationLegend,
  VisualizationTooltip,
  wrapArabicLabel,
} from "./shared";
import type {
  CompositionDatum,
  VisualizationDatum,
  VisualizationOrientation,
  VisualizationOutcome,
  VisualizationPartialRange,
  VisualizationReference,
  VisualizationSeriesDefinition,
  VisualizationSeriesToken,
  VisualizationValueFormat,
} from "./types";

const axisTick = { fill: "var(--md-chart-label)", fontSize: 11 };
const gridStroke = "var(--md-chart-grid)";

function tooltipItemsFromPayload(
  payload: readonly { dataKey?: string | number; value?: unknown; payload?: unknown }[] | undefined,
  series: VisualizationSeriesDefinition[],
) {
  if (!payload?.length) return [];
  const byKey = new Map(series.map((item) => [item.key, item]));
  return payload
    .map((entry, index) => {
      const key = String(entry.dataKey ?? "");
      const config = byKey.get(key);
      if (!config) return null;
      return {
        key: `${key}-${index}`,
        label: config.label,
        value: numericTooltipValue(entry.value),
        color: resolveSeriesColor(config.color, series.indexOf(config)),
        format: config.format,
        outcome: config.outcome,
        role: config.role,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && item.value !== null);
}

function noMeaningfulChartData(title: string, description: string) {
  return <DashboardEmptyState compact title={title} description={description} icon="chart" />;
}

export function TrendChart({
  data,
  series,
  ariaLabel,
  summary,
  variant = "line",
  reference,
  partialRange,
  includeZero = false,
}: {
  data: VisualizationDatum[];
  series: VisualizationSeriesDefinition[];
  ariaLabel: string;
  summary: string;
  variant?: "line" | "area";
  reference?: VisualizationReference;
  partialRange?: VisualizationPartialRange;
  includeZero?: boolean;
}) {
  const mobile = useMobileVisualization();
  const reducedMotion = useReducedVisualizationMotion();
  if (!data.length || !series.length || !hasMeaningfulSeriesData(data, series)) {
    return noMeaningfulChartData("لا توجد بيانات زمنية ذات معنى", "لا يرسم مَدار خطًا أو أصفارًا بدل البيانات المفقودة.");
  }

  const height = mobile ? 238 : 300;
  const yFormat = series[0]?.format;
  return (
    <VisualizationFrame ariaLabel={ariaLabel} summary={summary}>
      <VisualizationLegend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: 6, bottom: 4, left: mobile ? 0 : 8 }} accessibilityLayer>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            minTickGap={mobile ? 30 : 20}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            width={mobile ? 45 : 58}
            domain={includeZero ? [0, "auto"] : ["auto", "auto"]}
            tickFormatter={(value) => formatVisualizationValue(typeof value === "number" ? value : null, yFormat)}
          />
          {partialRange ? (
            <ReferenceArea
              x1={partialRange.fromLabel}
              x2={partialRange.toLabel}
              fill="var(--md-viz-partial-fill)"
              fillOpacity={1}
              ifOverflow="extendDomain"
              label={partialRange.label ? { value: partialRange.label, fill: "var(--md-chart-label)", fontSize: 11 } : undefined}
            />
          ) : null}
          {reference ? (
            <ReferenceLine
              y={reference.value}
              stroke={reference.kind === "target" ? "var(--md-viz-target)" : "var(--md-viz-reference)"}
              strokeDasharray={reference.kind === "target" ? "4 3" : "7 4"}
              label={{ value: reference.label, fill: "var(--md-chart-label)", fontSize: 11, position: "insideTopRight" }}
            />
          ) : null}
          <Tooltip
            cursor={{ stroke: "var(--md-border-strong)", strokeDasharray: "3 3" }}
            content={({ active, label, payload }) => (
              <VisualizationTooltip
                active={active}
                label={label}
                items={tooltipItemsFromPayload(payload, series)}
                context={getDatumTooltipContext(payload?.[0]?.payload)}
              />
            )}
          />
          {series.map((item, index) => {
            const color = resolveSeriesColor(item.color, index);
            const common = {
              key: item.key,
              type: "monotone" as const,
              dataKey: item.key,
              name: item.label,
              stroke: color,
              strokeWidth: item.role === "reference" ? 2 : 2.4,
              strokeDasharray: getSeriesStrokeDasharray(index, item.role),
              strokeOpacity: item.role === "reference" ? 0.72 : 1,
              connectNulls: false,
              isAnimationActive: !reducedMotion,
            };
            return variant === "area" ? (
              <Area {...common} fill={color} fillOpacity={0.12} dot={false} activeDot={{ r: 4 }} />
            ) : (
              <Line {...common} fill="none" dot={false} activeDot={{ r: 4 }} />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </VisualizationFrame>
  );
}

function categoryDomain(data: VisualizationDatum[], valueKey: string): [number, number] {
  const values = data
    .map((item) => item[valueKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return [0, 1];
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  return min === max ? [min, min + 1] : [min, max];
}

export function CategoryBarChart({
  data,
  valueKey,
  valueLabel,
  ariaLabel,
  summary,
  format,
  color = "series-1",
  outcome,
  orientation = "auto",
}: {
  data: VisualizationDatum[];
  valueKey: string;
  valueLabel: string;
  ariaLabel: string;
  summary: string;
  format?: VisualizationValueFormat;
  color?: VisualizationSeriesToken;
  outcome?: VisualizationOutcome;
  orientation?: VisualizationOrientation;
}) {
  const mobile = useMobileVisualization();
  const reducedMotion = useReducedVisualizationMotion();
  const maxLabelLength = Math.max(0, ...data.map((item) => item.label.length));
  const horizontal = orientation === "horizontal" || (orientation === "auto" && (mobile || maxLabelLength > 14));
  const series: VisualizationSeriesDefinition[] = [{ key: valueKey, label: valueLabel, color, outcome, format }];
  if (!data.length || !hasMeaningfulSeriesData(data, series)) {
    return noMeaningfulChartData("لا توجد فئات ذات بيانات", "لا يحول مَدار غياب القيم إلى أعمدة صفرية.");
  }

  const domain = categoryDomain(data, valueKey);
  const resolvedColor = resolveSeriesColor(color);
  const maxChars = mobile ? 18 : 24;
  const maxLines = Math.max(...data.map((item) => wrapArabicLabel(item.label, maxChars).length));
  const horizontalHeight = Math.max(230, data.length * Math.max(48, 22 + maxLines * 15) + 36);
  const height = horizontal ? horizontalHeight : mobile ? 238 : 290;

  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--md-surface-muted)", opacity: 0.45 }}
      content={({ active, label, payload }) => (
        <VisualizationTooltip
          active={active}
          label={label}
          items={tooltipItemsFromPayload(payload, series)}
          context={getDatumTooltipContext(payload?.[0]?.payload)}
        />
      )}
    />
  );

  return (
    <VisualizationFrame ariaLabel={ariaLabel} summary={summary}>
      <ResponsiveContainer width="100%" height={height}>
        {horizontal ? (
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 8, bottom: 4, left: 4 }} accessibilityLayer>
            <CartesianGrid stroke={gridStroke} horizontal={false} />
            <XAxis
              type="number"
              domain={domain}
              axisLine={false}
              tickLine={false}
              tick={axisTick}
              tickFormatter={(value) => formatVisualizationValue(typeof value === "number" ? value : null, format)}
            />
            <YAxis
              type="category"
              dataKey="label"
              orientation="right"
              axisLine={false}
              tickLine={false}
              width={mobile ? 148 : 190}
              interval={0}
              tick={<ArabicCategoryTick maxChars={maxChars} />}
            />
            {tooltip}
            <Bar dataKey={valueKey} name={valueLabel} fill={resolvedColor} radius={[6, 0, 0, 6]} isAnimationActive={!reducedMotion} />
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 4, left: 4 }} accessibilityLayer>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={20} />
            <YAxis
              domain={domain}
              axisLine={false}
              tickLine={false}
              tick={axisTick}
              width={mobile ? 44 : 56}
              tickFormatter={(value) => formatVisualizationValue(typeof value === "number" ? value : null, format)}
            />
            {tooltip}
            <Bar dataKey={valueKey} name={valueLabel} fill={resolvedColor} radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </VisualizationFrame>
  );
}

export function StackedBarChart({
  data,
  segments,
  ariaLabel,
  summary,
}: {
  data: VisualizationDatum[];
  segments: VisualizationSeriesDefinition[];
  ariaLabel: string;
  summary: string;
}) {
  const mobile = useMobileVisualization();
  const reducedMotion = useReducedVisualizationMotion();
  if (!data.length || !segments.length || !hasMeaningfulSeriesData(data, segments)) {
    return noMeaningfulChartData("لا توجد بيانات تركيبية كافية", "يظهر الرسم المكدس فقط عندما توجد أجزاء ذات معنى داخل إجمالي.");
  }
  const containsNegative = data.some((datum) =>
    segments.some((segment) => typeof datum[segment.key] === "number" && (datum[segment.key] as number) < 0),
  );
  if (containsNegative) {
    return <VisualizationGuidance>الرسم المكدس المشترك مخصص هنا لأجزاء غير سالبة من إجمالي. استخدم تمثيل مقارنة آخر للقيم الموجبة والسالبة.</VisualizationGuidance>;
  }

  return (
    <VisualizationFrame ariaLabel={ariaLabel} summary={summary}>
      <VisualizationLegend series={segments} />
      <ResponsiveContainer width="100%" height={mobile ? 245 : 295}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 4, left: 4 }} accessibilityLayer>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={mobile ? 30 : 20} />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} width={mobile ? 44 : 56} domain={[0, "auto"]} />
          <Tooltip
            cursor={{ fill: "var(--md-surface-muted)", opacity: 0.42 }}
            content={({ active, label, payload }) => (
              <VisualizationTooltip
                active={active}
                label={label}
                items={tooltipItemsFromPayload(payload, segments)}
                context={getDatumTooltipContext(payload?.[0]?.payload)}
              />
            )}
          />
          {segments.map((segment, index) => (
            <Bar
              key={segment.key}
              dataKey={segment.key}
              name={segment.label}
              stackId="total"
              fill={resolveSeriesColor(segment.color, index)}
              isAnimationActive={!reducedMotion}
              radius={index === segments.length - 1 ? [5, 5, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </VisualizationFrame>
  );
}

export const MAX_DONUT_SLICES = 5;

export function CompositionDonut({
  data,
  ariaLabel,
  summary,
  format,
  center,
}: {
  data: CompositionDatum[];
  ariaLabel: string;
  summary: string;
  format?: VisualizationValueFormat;
  center?: { label: string; value: string };
}) {
  const mobile = useMobileVisualization();
  const reducedMotion = useReducedVisualizationMotion();
  const valid = data.filter((item) => Number.isFinite(item.value) && item.value >= 0);
  const total = valid.reduce((sum, item) => sum + item.value, 0);
  if (!valid.length || total <= 0) {
    return noMeaningfulChartData("لا توجد تركيبة ذات معنى", "يحتاج Donut إلى أجزاء صحيحة من إجمالي حقيقي، لا إلى قيم مفقودة أو أصفار مصطنعة.");
  }
  if (valid.length > MAX_DONUT_SLICES) {
    return <VisualizationGuidance>عدد الفئات أكبر من النطاق المناسب للـDonut. استخدم Bar عندما تصبح مقارنة الفئات أهم من قراءة إجمالي بسيط.</VisualizationGuidance>;
  }

  const entries = valid.map((item, index) => ({
    key: `${item.label}-${index}`,
    label: item.label,
    color: resolveSeriesColor(item.color, index),
  }));
  return (
    <VisualizationFrame ariaLabel={ariaLabel} summary={summary}>
      <VisualizationCategoryLegend entries={entries} />
      <div className="md-viz-donut-wrap">
        <ResponsiveContainer width="100%" height={mobile ? 230 : 270}>
          <PieChart accessibilityLayer>
            <Tooltip
              content={({ active, payload }) => {
                const entry = payload?.[0];
                const payloadDatum = entry?.payload as CompositionDatum | undefined;
                if (!payloadDatum) return null;
                const index = valid.findIndex((item) => item === payloadDatum || item.label === payloadDatum.label);
                return (
                  <VisualizationTooltip
                    active={active}
                    label={payloadDatum.label}
                    items={[{
                      key: payloadDatum.label,
                      label: "القيمة",
                      value: numericTooltipValue(entry?.value),
                      color: resolveSeriesColor(payloadDatum.color, Math.max(0, index)),
                      format,
                    }]}
                  />
                );
              }}
            />
            <Pie
              data={valid}
              dataKey="value"
              nameKey="label"
              innerRadius={mobile ? 56 : 68}
              outerRadius={mobile ? 88 : 106}
              paddingAngle={2}
              stroke="var(--md-surface)"
              strokeWidth={2}
              isAnimationActive={!reducedMotion}
            >
              {valid.map((item, index) => (
                <Cell key={`${item.label}-${index}`} fill={resolveSeriesColor(item.color, index)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {center ? (
          <div className="md-viz-donut-center" aria-hidden="true">
            <small>{center.label}</small>
            <strong><bdi dir="ltr">{center.value}</bdi></strong>
          </div>
        ) : null}
      </div>
    </VisualizationFrame>
  );
}

export function TargetProgress({
  label,
  value,
  target,
  ariaLabel,
  summary,
  format,
  outcome = "unknown",
}: {
  label: string;
  value: number;
  target: number;
  ariaLabel: string;
  summary: string;
  format?: VisualizationValueFormat;
  outcome?: VisualizationOutcome;
}) {
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const safeValue = Number.isFinite(value) ? value : 0;
  const percentage = safeTarget > 0 ? Math.max(0, Math.min(100, (safeValue / safeTarget) * 100)) : 0;
  if (!safeTarget) {
    return <VisualizationGuidance>لا يمكن عرض التقدم دون هدف أو حد مرجعي صالح ومعلن.</VisualizationGuidance>;
  }
  return (
    <VisualizationFrame ariaLabel={ariaLabel} summary={summary}>
      <div className="md-viz-target" data-outcome={outcome}>
        <div className="md-viz-target-header">
          <strong>{label}</strong>
          <span>
            <bdi dir="ltr">{formatVisualizationValue(safeValue, format)}</bdi>
            <span aria-hidden="true"> / </span>
            <span className="md-viz-sr-only">من هدف قدره</span>
            <bdi dir="ltr">{formatVisualizationValue(safeTarget, format)}</bdi>
          </span>
        </div>
        <div
          className="md-viz-target-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={safeTarget}
          aria-valuenow={safeValue}
          aria-label={label}
        >
          <span className="md-viz-target-fill" style={{ width: `${percentage}%` }} />
          <span className="md-viz-target-marker" aria-hidden="true" />
        </div>
        <small className="md-viz-target-context">{formatVisualizationValue(percentage / 100, { style: "percent", maximumFractionDigits: 0 })} من المرجع</small>
      </div>
    </VisualizationFrame>
  );
}

export function Sparkline({
  values,
  ariaLabel,
  color = "series-1",
}: {
  values: Array<number | null>;
  ariaLabel: string;
  color?: VisualizationSeriesToken;
}) {
  const reducedMotion = useReducedVisualizationMotion();
  const data = values.map((value, index) => ({ index, value }));
  const hasData = values.some((value) => typeof value === "number" && Number.isFinite(value));
  if (!hasData) return <span className="md-viz-sparkline-empty">لا توجد حركة كافية</span>;
  return (
    <div className="md-viz-sparkline" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={42}>
        <LineChart data={data} accessibilityLayer margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={resolveSeriesColor(color)}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={!reducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VisualizationSeriesSample({
  token,
  label,
}: {
  token: VisualizationSeriesToken;
  label: string;
}) {
  return (
    <span className="md-viz-series-sample" style={{ "--md-viz-sample": resolveSeriesColor(token) } as CSSProperties}>
      <span aria-hidden="true" />{label}
    </span>
  );
}

export { VISUALIZATION_SERIES_TOKENS };
