import Link from "next/link";
import type { ReactNode } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Panel,
  Skeleton,
  SkeletonGroup,
  cx,
} from "@/components/ui/Enterprise";
import { Icon, type IconName } from "@/components/ui/Icons";
import type {
  DashboardAlertSeverity,
  DashboardDatePreset,
  DashboardDensity,
  DashboardFilterScope,
  DashboardModuleState,
  DashboardTone,
  DashboardTrustState,
} from "./types";

type HeadingLevel = "h2" | "h3";
type ValueDirection = "auto" | "ltr" | "rtl";
type MetricContextKind = "absolute" | "delta" | "reference" | "target";

export function DashboardSectionHeader({
  eyebrow,
  title,
  description,
  actions,
  headingLevel = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  headingLevel?: HeadingLevel;
  className?: string;
}) {
  const Heading = headingLevel;
  return (
    <header className={cx("md-dashboard-section-header", className)}>
      <div className="md-dashboard-section-heading-copy">
        {eyebrow ? <span className="md-dashboard-eyebrow">{eyebrow}</span> : null}
        <Heading className="md-dashboard-section-title">{title}</Heading>
        {description ? <p className="md-dashboard-section-description">{description}</p> : null}
      </div>
      {actions ? <div className="md-dashboard-section-actions">{actions}</div> : null}
    </header>
  );
}

export function DashboardSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  priority = "normal",
  density = "comfortable",
  headingLevel = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  priority?: "critical" | "primary" | "normal" | "supporting";
  density?: DashboardDensity;
  headingLevel?: HeadingLevel;
  className?: string;
}) {
  return (
    <section
      className={cx("md-dashboard-section", `is-${density}`, className)}
      data-priority={priority}
    >
      <DashboardSectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
        headingLevel={headingLevel}
      />
      <div className="md-dashboard-section-body">{children}</div>
    </section>
  );
}

export function DashboardMetricGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("md-dashboard-metric-grid", className)}>{children}</div>;
}

export function MetricContext({
  label,
  value,
  kind = "reference",
  className = "",
}: {
  label: string;
  value: ReactNode;
  kind?: MetricContextKind;
  className?: string;
}) {
  return (
    <span className={cx("md-dashboard-metric-context", className)} data-kind={kind}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

export function DashboardMetricCard({
  label,
  value,
  unit,
  supportingContext,
  comparison,
  trust,
  status,
  action,
  valueDirection = "auto",
  compactOnMobile = false,
  className = "",
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  supportingContext?: ReactNode;
  comparison?: ReactNode;
  trust?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  valueDirection?: ValueDirection;
  compactOnMobile?: boolean;
  className?: string;
}) {
  return (
    <Card
      as="article"
      className={cx(
        "md-dashboard-metric",
        compactOnMobile && "is-compact-mobile",
        className,
      )}
    >
      <div className="md-dashboard-metric-topline">
        <span className="md-dashboard-metric-label">{label}</span>
        {status ? <div className="md-dashboard-metric-status">{status}</div> : null}
      </div>
      <div className="md-dashboard-metric-value-row">
        <bdi className="md-dashboard-metric-value" dir={valueDirection}>
          {value}
        </bdi>
        {unit ? <span className="md-dashboard-metric-unit">{unit}</span> : null}
      </div>
      {supportingContext || comparison ? (
        <div className="md-dashboard-metric-secondary">
          {supportingContext ? (
            <div className="md-dashboard-metric-supporting">{supportingContext}</div>
          ) : null}
          {comparison ? <div className="md-dashboard-metric-comparison">{comparison}</div> : null}
        </div>
      ) : null}
      {trust || action ? (
        <div className="md-dashboard-metric-footer">
          {trust ? <div className="md-dashboard-metric-trust">{trust}</div> : <span />}
          {action ? <div className="md-dashboard-metric-action">{action}</div> : null}
        </div>
      ) : null}
    </Card>
  );
}

export function DashboardSummaryBlock({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cx("md-dashboard-summary", className)}>
      {title || description || action ? (
        <div className="md-dashboard-summary-header">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      <div className="md-dashboard-summary-body">{children}</div>
    </Panel>
  );
}

const toneIcons: Record<DashboardTone, IconName> = {
  neutral: "info",
  info: "info",
  success: "check",
  warning: "warning",
  danger: "warning",
};

export function DashboardStatusBlock({
  title,
  description,
  tone = "neutral",
  meta,
  action,
  icon,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  tone?: DashboardTone;
  meta?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <div className={cx("md-dashboard-status", `is-${tone}`, className)} role="status">
      <span className="md-dashboard-message-icon" aria-hidden="true">
        <Icon name={icon ?? toneIcons[tone]} />
      </span>
      <div className="md-dashboard-message-copy">
        <span className="md-dashboard-message-kind">الحالة الحالية</span>
        <strong>{title}</strong>
        {description ? <div className="md-dashboard-message-description">{description}</div> : null}
        {meta ? <div className="md-dashboard-message-meta">{meta}</div> : null}
      </div>
      {action ? <div className="md-dashboard-message-action">{action}</div> : null}
    </div>
  );
}

export function DashboardInsightBlock({
  title,
  description,
  meta,
  action,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("md-dashboard-insight", className)}>
      <span className="md-dashboard-message-icon" aria-hidden="true">
        <Icon name="sparkles" />
      </span>
      <div className="md-dashboard-message-copy">
        <span className="md-dashboard-message-kind">ملاحظة</span>
        <strong>{title}</strong>
        {description ? <div className="md-dashboard-message-description">{description}</div> : null}
        {meta ? <div className="md-dashboard-message-meta">{meta}</div> : null}
      </div>
      {action ? <div className="md-dashboard-message-action">{action}</div> : null}
    </article>
  );
}

const alertLabels: Record<DashboardAlertSeverity, string> = {
  attention: "يحتاج انتباهًا",
  warning: "تحذير",
  critical: "تنبيه حرج",
};

export function DashboardAlertBlock({
  title,
  description,
  severity = "attention",
  meta,
  action,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  severity?: DashboardAlertSeverity;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const isCritical = severity === "critical";
  return (
    <div
      className={cx("md-dashboard-alert", `is-${severity}`, className)}
      role={isCritical ? "alert" : undefined}
      aria-live={isCritical ? "assertive" : undefined}
      data-severity={severity}
    >
      <span className="md-dashboard-message-icon" aria-hidden="true">
        <Icon name="warning" />
      </span>
      <div className="md-dashboard-message-copy">
        <span className="md-dashboard-message-kind">{alertLabels[severity]}</span>
        <strong>{title}</strong>
        {description ? <div className="md-dashboard-message-description">{description}</div> : null}
        {meta ? <div className="md-dashboard-message-meta">{meta}</div> : null}
      </div>
      {action ? <div className="md-dashboard-message-action">{action}</div> : null}
    </div>
  );
}

export function DashboardCriticalException({
  title,
  description,
  impact,
  action,
  trust,
  className = "",
}: {
  title: string;
  description: ReactNode;
  impact?: ReactNode;
  action?: ReactNode;
  trust?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx("md-dashboard-critical", className)}
      role="alert"
      aria-live="assertive"
      aria-label="استثناء حرج"
    >
      <div className="md-dashboard-critical-icon" aria-hidden="true">
        <Icon name="warning" />
      </div>
      <div className="md-dashboard-critical-copy">
        <span className="md-dashboard-critical-kind">استثناء حرج</span>
        <h2>{title}</h2>
        <div className="md-dashboard-critical-description">{description}</div>
        {impact ? <div className="md-dashboard-critical-impact">{impact}</div> : null}
        {trust ? <div className="md-dashboard-critical-trust">{trust}</div> : null}
      </div>
      {action ? <div className="md-dashboard-critical-action">{action}</div> : null}
    </section>
  );
}

const trustLabels: Record<DashboardTrustState, string> = {
  fresh: "البيانات محدثة",
  syncing: "جارٍ تحديث البيانات",
  stale: "البيانات قديمة",
  partial: "البيانات جزئية",
  unknown: "حداثة البيانات غير معروفة",
  error: "تعذر التحقق من البيانات",
};

const trustIcons: Record<DashboardTrustState, IconName> = {
  fresh: "check",
  syncing: "refresh",
  stale: "clock",
  partial: "layers",
  unknown: "info",
  error: "warning",
};

export function DataTrustIndicator({
  state,
  label,
  updatedAt,
  detail,
  compact = false,
  className = "",
}: {
  state: DashboardTrustState;
  label?: string;
  updatedAt?: ReactNode;
  detail?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx("md-dashboard-trust", `is-${state}`, compact && "is-compact", className)}
      data-trust-state={state}
    >
      <Icon name={trustIcons[state]} />
      <span className="md-dashboard-trust-copy">
        <span>{label ?? trustLabels[state]}</span>
        {updatedAt ? <small>آخر تحديث: {updatedAt}</small> : null}
        {detail ? <small>{detail}</small> : null}
      </span>
    </span>
  );
}

export function DashboardDataState({
  state,
  title,
  description,
  action,
  className = "",
}: {
  state: Exclude<DashboardTrustState, "fresh">;
  title?: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx("md-dashboard-data-state", `is-${state}`, className)}
      role={state === "error" ? "alert" : "status"}
    >
      <DataTrustIndicator state={state} compact />
      <div className="md-dashboard-data-state-copy">
        {title ? <strong>{title}</strong> : null}
        <div>{description}</div>
      </div>
      {action ? <div className="md-dashboard-data-state-action">{action}</div> : null}
    </div>
  );
}

export function DashboardFilterBar({
  scope,
  label,
  description,
  children,
  activeFilters,
  clearHref,
  className = "",
}: {
  scope: DashboardFilterScope;
  label?: string;
  description?: string;
  children: ReactNode;
  activeFilters?: ReactNode;
  clearHref?: string;
  className?: string;
}) {
  const scopeLabel = scope === "global" ? "مرشحات النظرة العامة" : "مرشحات هذا القسم";
  return (
    <section
      className={cx("md-dashboard-filter-bar", `is-${scope}`, className)}
      data-filter-scope={scope}
      aria-label={label ?? scopeLabel}
    >
      <div className="md-dashboard-filter-heading">
        <div>
          <span className="md-dashboard-filter-scope">{scopeLabel}</span>
          {label ? <strong>{label}</strong> : null}
          {description ? <p>{description}</p> : null}
        </div>
        {clearHref ? (
          <Link className="md-button md-button-ghost md-button-sm" href={clearHref}>
            مسح المرشحات
          </Link>
        ) : null}
      </div>
      <div className="md-dashboard-filter-controls">{children}</div>
      {activeFilters ? <div className="md-dashboard-active-filters">{activeFilters}</div> : null}
    </section>
  );
}

export function ActiveFilterChip({
  label,
  value,
  removeHref,
  scope,
  className = "",
}: {
  label: string;
  value: ReactNode;
  removeHref?: string;
  scope?: DashboardFilterScope;
  className?: string;
}) {
  return (
    <span className={cx("md-dashboard-active-filter", className)} data-filter-scope={scope}>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      {removeHref ? (
        <Link href={removeHref} aria-label={`إزالة المرشح: ${label}`}>
          <Icon name="close" />
        </Link>
      ) : null}
    </span>
  );
}

export function DateRangeControl({
  presets = [],
  from,
  to,
  action,
  fromName = "from",
  toName = "to",
  label = "الفترة الزمنية",
  customLabel = "فترة مخصصة",
  submitLabel = "تطبيق",
  className = "",
}: {
  presets?: DashboardDatePreset[];
  from?: string;
  to?: string;
  action?: string;
  fromName?: string;
  toName?: string;
  label?: string;
  customLabel?: string;
  submitLabel?: string;
  className?: string;
}) {
  return (
    <div className={cx("md-dashboard-date-range", className)} role="group" aria-label={label}>
      {presets.length ? (
        <nav className="md-dashboard-date-presets" aria-label="فترات جاهزة">
          {presets.map((preset) => (
            <Link
              key={`${preset.label}-${preset.href}`}
              href={preset.href}
              aria-current={preset.active ? "page" : undefined}
            >
              {preset.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <form className="md-dashboard-custom-range" action={action} method="get">
        <span className="md-dashboard-custom-range-label">{customLabel}</span>
        <label>
          <span>من</span>
          <Input type="date" name={fromName} defaultValue={from} dir="ltr" />
        </label>
        <label>
          <span>إلى</span>
          <Input type="date" name={toName} defaultValue={to} dir="ltr" />
        </label>
        <Button type="submit" size="sm" variant="secondary">
          {submitLabel}
        </Button>
      </form>
    </div>
  );
}

export function DashboardDrillDownLink({
  href,
  children = "عرض التفاصيل",
  className = "",
}: {
  href: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Link className={cx("md-dashboard-drilldown", className)} href={href}>
      <span>{children}</span>
      <Icon name="arrow" className="md-icon-directional" />
    </Link>
  );
}

export function DashboardEmptyState({
  title,
  description,
  context,
  action,
  icon = "layers",
  compact = false,
}: {
  title: string;
  description: string;
  context?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  compact?: boolean;
}) {
  return (
    <div className="md-dashboard-empty" data-empty-kind="no-meaningful-data">
      <EmptyState
        title={title}
        description={description}
        icon={icon}
        action={action}
        compact={compact}
      />
      {context ? <div className="md-dashboard-empty-context">{context}</div> : null}
    </div>
  );
}

export function DashboardLoadingState({
  label = "جارٍ تحميل بيانات النظرة العامة",
  cards = 3,
  className = "",
}: {
  label?: string;
  cards?: number;
  className?: string;
}) {
  const count = Math.max(1, Math.min(cards, 6));
  return (
    <SkeletonGroup label={label} className={cx("md-dashboard-loading", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div className="md-dashboard-loading-card" key={index}>
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-8 w-3/5" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

export function DashboardErrorState({
  title = "تعذر تحميل هذا الجزء",
  description,
  action,
  compact = true,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="md-dashboard-error">
      <ErrorState
        title={title}
        description={description}
        action={action}
        level={compact ? "section" : "page"}
      />
    </div>
  );
}

export function DashboardVisualizationShell({
  title,
  description,
  actions,
  children,
  state = "ready",
  stateTitle,
  stateDescription,
  stateAction,
  trust,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  state?: DashboardModuleState;
  stateTitle?: string;
  stateDescription?: string;
  stateAction?: ReactNode;
  trust?: ReactNode;
  className?: string;
}) {
  let content = children;
  if (state === "loading") content = <DashboardLoadingState cards={1} />;
  if (state === "empty") {
    content = (
      <DashboardEmptyState
        compact
        title={stateTitle ?? "لا توجد بيانات كافية للعرض"}
        description={stateDescription ?? "سيظهر المحتوى عندما تتوفر بيانات ذات معنى ضمن هذا السياق."}
        action={stateAction}
        icon="chart"
      />
    );
  }
  if (state === "error") {
    content = (
      <DashboardErrorState
        title={stateTitle}
        description={stateDescription ?? "تعذر تجهيز هذا العرض الآن."}
        action={stateAction}
      />
    );
  }
  return (
    <Panel className={cx("md-dashboard-visualization-shell", className)}>
      <div className="md-dashboard-visualization-header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="md-dashboard-visualization-actions">{actions}</div> : null}
      </div>
      {trust ? <div className="md-dashboard-visualization-trust">{trust}</div> : null}
      <div className="md-dashboard-visualization-body" data-state={state}>
        {content}
      </div>
    </Panel>
  );
}

export function DashboardSupportingInfo({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("md-dashboard-supporting-info", className)}>
      {title || description ? (
        <div className="md-dashboard-supporting-heading">
          {title ? <h3>{title}</h3> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      <div className="md-dashboard-supporting-body">{children}</div>
    </div>
  );
}
