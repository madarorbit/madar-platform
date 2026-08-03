import type {
  OperatingMode,
  PlanLevel,
  PlanTerm,
  SupportedCurrency,
} from "./account";
import { LAUNCH_PRICE_NOTICE } from "./account";

export const BASE_MONTHLY_SAR: Record<PlanLevel, number> = {
  BASIC: 5,
  PREMIUM: 20,
  FULL: 50,
};
export const TERM_DISCOUNTS: Record<PlanTerm, number> = {
  1: 0,
  6: 0.1,
  12: 0.2,
};
export const MODE_MULTIPLIERS: Record<OperatingMode, number> = {
  MADAR_NATIVE: 1,
  CONNECTED_EXTERNAL: 1.2,
};
export const CURRENCY_RATES_FROM_SAR: Record<SupportedCurrency, number> = {
  SAR: 1,
  USD: 1 / 3.75,
  YER: 405,
};
export const TRIAL_DAYS = 20;

export type PricingVariant = {
  code: string;
  level: PlanLevel;
  termMonths: PlanTerm;
  operatingMode: OperatingMode;
  discount: number;
  multiplier: number;
};
export type PriceQuote = PricingVariant & {
  currency: SupportedCurrency;
  amount: number;
  monthlyEquivalent: number;
  trialDays: number;
  launchNotice: string;
};

const round = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
export function variantCode(
  level: PlanLevel,
  termMonths: PlanTerm,
  operatingMode: OperatingMode,
) {
  return `${level}-${termMonths}M-${operatingMode === "MADAR_NATIVE" ? "NATIVE" : "CONNECTED"}`;
}
export function quotePrice(
  level: PlanLevel,
  termMonths: PlanTerm,
  operatingMode: OperatingMode,
  currency: SupportedCurrency,
): PriceQuote {
  const discount = TERM_DISCOUNTS[termMonths],
    multiplier = MODE_MULTIPLIERS[operatingMode],
    monthlySar = BASE_MONTHLY_SAR[level] * (1 - discount) * multiplier;
  return {
    code: variantCode(level, termMonths, operatingMode),
    level,
    termMonths,
    operatingMode,
    discount,
    multiplier,
    currency,
    amount: round(monthlySar * termMonths * CURRENCY_RATES_FROM_SAR[currency]),
    monthlyEquivalent: round(monthlySar * CURRENCY_RATES_FROM_SAR[currency]),
    trialDays: TRIAL_DAYS,
    launchNotice: LAUNCH_PRICE_NOTICE,
  };
}
export function buildPricingVariants() {
  const levels = ["BASIC", "PREMIUM", "FULL"] as const,
    terms = [1, 6, 12] as const,
    modes = ["MADAR_NATIVE", "CONNECTED_EXTERNAL"] as const;
  return levels.flatMap((level) =>
    terms.flatMap((termMonths) =>
      modes.map((operatingMode) => ({
        code: variantCode(level, termMonths, operatingMode),
        level,
        termMonths,
        operatingMode,
        discount: TERM_DISCOUNTS[termMonths],
        multiplier: MODE_MULTIPLIERS[operatingMode],
      })),
    ),
  );
}
