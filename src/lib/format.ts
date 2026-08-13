const DEFAULT_LOCALE = 'ar-YE';
const DEFAULT_TIME_ZONE = 'Asia/Aden';

export function formatCurrency(
  value: number | string | null | undefined,
  currency = 'YER',
  options: Intl.NumberFormatOptions = {},
) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2,
    ...options,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(
  value: string | number | Date | null | undefined,
  style: 'short' | 'medium' | 'long' = 'medium',
) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const styles: Record<typeof style, Intl.DateTimeFormatOptions> = {
    short: {year: 'numeric', month: '2-digit', day: '2-digit'},
    medium: {year: 'numeric', month: 'short', day: 'numeric'},
    long: {year: 'numeric', month: 'long', day: 'numeric'},
  };
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {...styles[style], timeZone: DEFAULT_TIME_ZONE}).format(date);
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}
