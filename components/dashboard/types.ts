export type DashboardFilterScope = "global" | "local";

export type DashboardTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type DashboardAlertSeverity = "attention" | "warning" | "critical";

export type DashboardTrustState =
  | "fresh"
  | "syncing"
  | "stale"
  | "partial"
  | "unknown"
  | "error";

export type DashboardModuleState = "ready" | "loading" | "empty" | "error";

export type DashboardDensity = "comfortable" | "compact";

export type DashboardDatePreset = {
  label: string;
  href: string;
  active?: boolean;
};
