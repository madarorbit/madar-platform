export const ACCOUNT_TYPES = ["PERSONAL", "BUSINESS"] as const;
export const OPERATING_MODES = ["MADAR_NATIVE", "CONNECTED_EXTERNAL"] as const;
export const PLAN_LEVELS = ["BASIC", "PREMIUM", "FULL"] as const;
export const PLAN_TERMS = [1, 6, 12] as const;
export const SUPPORTED_CURRENCIES = ["SAR", "USD", "YER"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type OperatingMode = (typeof OPERATING_MODES)[number];
export type PlanLevel = (typeof PLAN_LEVELS)[number];
export type PlanTerm = (typeof PLAN_TERMS)[number];
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const accountTypeLabels: Record<AccountType, string> = {
  PERSONAL: "حساب شخصي",
  BUSINESS: "حساب تجاري",
};
export const operatingModeLabels: Record<OperatingMode, string> = {
  MADAR_NATIVE: "بدء نشاط جديد على مَدار",
  CONNECTED_EXTERNAL: "ربط نشاط قائم",
};
export const planLevelLabels: Record<PlanLevel, string> = {
  BASIC: "الاشتراك العادي",
  PREMIUM: "الاشتراك المميز",
  FULL: "الاشتراك الكامل",
};
export const LAUNCH_PRICE_NOTICE =
  "سعر خاص بمناسبة الإطلاق الأول، وسيتم تغييره لاحقًا.";

export function isAccountType(value: unknown): value is AccountType {
  return (
    typeof value === "string" &&
    (ACCOUNT_TYPES as readonly string[]).includes(value)
  );
}
export function isOperatingMode(value: unknown): value is OperatingMode {
  return (
    typeof value === "string" &&
    (OPERATING_MODES as readonly string[]).includes(value)
  );
}
export function isPlanLevel(value: unknown): value is PlanLevel {
  return (
    typeof value === "string" &&
    (PLAN_LEVELS as readonly string[]).includes(value)
  );
}
export function isPlanTerm(value: unknown): value is PlanTerm {
  return (
    typeof value === "number" &&
    (PLAN_TERMS as readonly number[]).includes(value)
  );
}
export function isSupportedCurrency(
  value: unknown,
): value is SupportedCurrency {
  return (
    typeof value === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}
