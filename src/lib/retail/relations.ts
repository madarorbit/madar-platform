export function relationName(value: unknown, fallback = "—") {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: unknown } | undefined;
    return typeof first?.name === "string" ? first.name : fallback;
  }
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? name : fallback;
  }
  return fallback;
}

export function relationValue(value: unknown, key: string, fallback = "—") {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && typeof candidate === "object" && key in candidate) {
    const result = (candidate as Record<string, unknown>)[key];
    return typeof result === "string" ? result : fallback;
  }
  return fallback;
}
