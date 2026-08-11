export function formatMoney(value: number | string | null | undefined, currency = "YER") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("ar-YE", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: currency === "YER" ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatQuantity(value: number | string | null | undefined) {
  return new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 3 }).format(
    Number(value ?? 0),
  );
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-YE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Aden",
  }).format(new Date(value));
}
