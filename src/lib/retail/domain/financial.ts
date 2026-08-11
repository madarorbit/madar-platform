export function moneyToMinor(value: number | string) {
  const normalized = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("INVALID_MONEY");
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error("MONEY_OUT_OF_RANGE");
  return negative ? -minor : minor;
}

export function lineTotalMinor(quantity: number, unitPriceMinor: number) {
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isSafeInteger(unitPriceMinor)) throw new Error("INVALID_LINE");
  return Math.round(quantity * unitPriceMinor);
}

export function allocateDiscount(lineTotalsMinor: number[], discountMinor: number) {
  const subtotal = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  if (discountMinor < 0 || discountMinor > subtotal) throw new Error("INVALID_DISCOUNT");
  let allocated = 0;
  return lineTotalsMinor.map((line, index) => {
    const value = index === lineTotalsMinor.length - 1
      ? discountMinor - allocated
      : subtotal === 0 ? 0 : Math.round((line * discountMinor) / subtotal);
    allocated += value;
    return value;
  });
}

export function paymentStatus(totalMinor: number, paidMinor: number) {
  if (totalMinor < 0 || paidMinor < 0 || paidMinor > totalMinor) throw new Error("INVALID_PAYMENT");
  if (paidMinor === totalMinor) return "paid" as const;
  if (paidMinor === 0) return "credit" as const;
  return "partial" as const;
}

export function nextStock(current: number, delta: number) {
  const result = current + delta;
  if (!Number.isFinite(result) || result < 0) throw new Error("INSUFFICIENT_STOCK");
  return result;
}
