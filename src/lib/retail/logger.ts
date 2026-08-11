type LogLevel = "info" | "warn" | "error";
type SafeValue = string | number | boolean | null | undefined;

const BLOCKED_KEY = /(password|token|secret|authorization|cookie|prompt|message|proof)/i;

export function logEvent(level: LogLevel, event: string, metadata: Record<string, SafeValue> = {}) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !BLOCKED_KEY.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value]),
  );
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...safeMetadata });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}
