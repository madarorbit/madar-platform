import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { applyHttpAuthentication } from "../auth";
import type {
  Connector,
  ConnectorBatch,
  ConnectorContext,
  ConnectorSyncRequest,
  JsonObject,
  JsonValue,
} from "../contracts";
import { IntegrationError } from "../errors";

type StreamConfig = {
  key: string;
  path: string;
  recordsPath?: string;
  cursorParam?: string;
  nextCursorPath?: string;
  watermarkPath?: string;
};
type WriteRoute = {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  verifyPath?: string;
  compensatePath?: string;
};
const GENERIC_STREAMS = [
  "products",
  "customers",
  "suppliers",
  "inventory",
  "sales",
  "expenses",
  "purchase_orders",
  "goods_receipts",
  "sales_returns",
  "recipes",
  "restaurant_orders",
  "kitchen_tickets",
  "hotel_properties",
  "hotel_rooms",
  "hotel_rates",
  "hotel_reservations",
  "hotel_stays",
  "hotel_folios",
].map((key) => ({
  key,
  label: key,
  supportsInitial: true,
  supportsIncremental: true,
  defaultPageSize: 500,
}));
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const getPath = (value: unknown, path: string | undefined) =>
  path
    ?.split(".")
    .reduce<unknown>(
      (current, key) => (object(current) ? current[key] : undefined),
      value,
    );
const privateV4 = (address: string) =>
  /^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(address) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(address);
const privateV6 = (address: string) =>
  address === "::1" ||
  address.startsWith("fc") ||
  address.startsWith("fd") ||
  address.startsWith("fe80:");
async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:")
    throw new IntegrationError(
      "موصل REST يقبل HTTPS فقط.",
      "VALIDATION_ERROR",
      false,
    );
  if (["localhost", "localhost.localdomain"].includes(url.hostname))
    throw new IntegrationError(
      "عناوين الشبكة المحلية غير مسموحة.",
      "VALIDATION_ERROR",
      false,
    );
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (
    addresses.some(({ address }) =>
      isIP(address) === 4 ? privateV4(address) : privateV6(address),
    )
  )
    throw new IntegrationError(
      "لا يمكن لموصل REST الوصول إلى شبكة خاصة.",
      "VALIDATION_ERROR",
      false,
    );
  return url;
}
function config(context: ConnectorContext) {
  return context.connection.config as {
    base_url: string;
    health_path?: string;
    streams: StreamConfig[];
    write_routes?: Record<string, WriteRoute>;
  };
}
function streams(input: unknown): StreamConfig[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) =>
    object(item) &&
    typeof item.key === "string" &&
    typeof item.path === "string"
      ? [
          {
            key: item.key,
            path: item.path,
            recordsPath:
              typeof item.records_path === "string"
                ? item.records_path
                : undefined,
            cursorParam:
              typeof item.cursor_param === "string"
                ? item.cursor_param
                : undefined,
            nextCursorPath:
              typeof item.next_cursor_path === "string"
                ? item.next_cursor_path
                : undefined,
            watermarkPath:
              typeof item.watermark_path === "string"
                ? item.watermark_path
                : undefined,
          },
        ]
      : [],
  );
}
async function request(
  context: ConnectorContext,
  path: string,
  init: RequestInit = {},
) {
  const base = await assertPublicUrl(config(context).base_url),
    url = new URL(path, base);
  if (url.origin !== base.origin)
    throw new IntegrationError(
      "مسار الموصل خرج عن نطاق المضيف المعتمد.",
      "VALIDATION_ERROR",
      false,
    );
  const authenticated = applyHttpAuthentication(
      url.toString(),
      {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...Object.fromEntries(new Headers(init.headers)),
        },
      },
      context.authScheme,
      context.secret,
    ),
    response = await fetch(authenticated.url, {
      ...authenticated.init,
      signal: context.signal,
      cache: "no-store",
      redirect: "error",
    }),
    raw = await response.text();
  let payload: unknown = null;
  if (raw.trim())
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new IntegrationError(
        "أعاد النظام الخارجي JSON غير صالح.",
        "SOURCE_ERROR",
        false,
        { status: response.status },
      );
    }
  if (!response.ok) return { response, payload };
  return { response, payload };
}
function records(payload: unknown, path?: string) {
  const value = path
    ? getPath(payload, path)
    : object(payload)
      ? (payload.data ?? payload.records ?? payload.items)
      : payload;
  return Array.isArray(value) ? (value.filter(object) as JsonObject[]) : [];
}

export const genericRestConnector: Connector = {
  manifest: {
    key: "madar.generic-rest",
    version: "2.0.0",
    displayName: "REST API",
    description: "موصل REST عام موثق وقابل للقراءة والكتابة المحدودة.",
    authSchemes: ["api_key", "bearer", "basic", "oauth2"],
    streams: GENERIC_STREAMS,
    capabilities: {
      read: true,
      write: true,
      webhooks: true,
      polling: true,
      files: false,
      database: false,
      localBridge: false,
    },
    channels: ["OAUTH", "API_KEY", "WEBHOOK"],
    supportedVerticals: ["commerce", "food_service", "hospitality"],
    certification: "certified",
    setupSchema: {
      fields: [
        { key: "base_url", type: "url", required: true },
        { key: "streams", type: "json", required: true },
      ],
    },
  },
  validateConfig(input) {
    if (!object(input))
      return {
        valid: false,
        issues: [{ path: "config", message: "إعدادات REST مطلوبة." }],
      };
    try {
      const base = new URL(String(input.base_url || ""));
      if (base.protocol !== "https:") throw new Error();
      const normalizedStreams = streams(input.streams);
      if (!normalizedStreams.length)
        return {
          valid: false,
          issues: [
            { path: "streams", message: "أضف مسار بيانات واحدًا على الأقل." },
          ],
        };
      const writeRoutes = object(input.write_routes) ? input.write_routes : {};
      return {
        valid: true,
        normalizedConfig: {
          base_url: base.toString(),
          health_path:
            typeof input.health_path === "string"
              ? input.health_path
              : "/health",
          streams: normalizedStreams as unknown as JsonValue,
          write_routes: writeRoutes as JsonObject,
        },
      };
    } catch {
      return {
        valid: false,
        issues: [{ path: "base_url", message: "رابط HTTPS صالح مطلوب." }],
      };
    }
  },
  async testConnection(context) {
    const started = Date.now(),
      result = await request(context, config(context).health_path || "/health");
    return {
      ok: result.response.ok,
      latencyMs: Date.now() - started,
      accountLabel:
        result.response.headers.get("x-account-name") ||
        new URL(config(context).base_url).hostname,
      warnings: result.response.ok ? [] : [`HTTP ${result.response.status}`],
    };
  },
  async *initialSync(context, syncRequest) {
    yield* sync(context, syncRequest, false);
  },
  async *incrementalSync(context, syncRequest) {
    yield* sync(context, syncRequest, true);
  },
  async write(context, command) {
    const route = config(context).write_routes?.[command.resourceKey];
    if (!route)
      throw new IntegrationError(
        "لا يوجد عقد كتابة معتمد لهذا المورد في الموصل.",
        "WRITE_NOT_SUPPORTED",
        false,
        { resourceKey: command.resourceKey },
      );
    const path = route.path.replace(
        "{id}",
        encodeURIComponent(command.entityId),
      ),
      headers: Record<string, string> = {
        "Idempotency-Key": command.idempotencyKey,
      };
    if (command.expectedSourceVersion)
      headers["If-Match"] = command.expectedSourceVersion;
    const result = await request(context, path, {
      method: route.method || "PATCH",
      headers,
      body: JSON.stringify(command.desiredChange),
    });
    if (result.response.status === 409 || result.response.status === 412)
      return {
        ok: false,
        conflict: true,
        sourceVersion: result.response.headers.get("etag") || undefined,
        sourceSnapshot: object(result.payload)
          ? (result.payload as JsonObject)
          : {},
      };
    if (!result.response.ok)
      throw new IntegrationError(
        "رفض النظام الخارجي أمر الكتابة.",
        "SOURCE_WRITE_FAILED",
        result.response.status >= 500 || result.response.status === 429,
        { status: result.response.status },
      );
    return {
      ok: true,
      sourceRequestId: result.response.headers.get("x-request-id") || undefined,
      sourceVersion: result.response.headers.get("etag") || undefined,
      sourceSnapshot: object(result.payload)
        ? (result.payload as JsonObject)
        : {},
      canonicalAfter: object(result.payload)
        ? (result.payload as JsonObject)
        : command.desiredChange,
      compensationPayload:
        object(result.payload) && object(result.payload.previous)
          ? (result.payload.previous as JsonObject)
          : undefined,
    };
  },
  async verifyWrite(context, command, result) {
    const route = config(context).write_routes?.[command.resourceKey];
    if (!route?.verifyPath)
      return {
        verified: result.ok,
        sourceVersion: result.sourceVersion,
        sourceSnapshot: result.sourceSnapshot,
        canonicalAfter: result.canonicalAfter,
      };
    const check = await request(
      context,
      route.verifyPath.replace("{id}", encodeURIComponent(command.entityId)),
    );
    if (!check.response.ok)
      return { verified: false, reason: `HTTP ${check.response.status}` };
    const source = object(check.payload) ? (check.payload as JsonObject) : {};
    const verified = Object.entries(command.desiredChange).every(
      ([key, value]) => JSON.stringify(source[key]) === JSON.stringify(value),
    );
    return {
      verified,
      sourceVersion: check.response.headers.get("etag") || result.sourceVersion,
      sourceSnapshot: source,
      canonicalAfter: source,
      reason: verified ? undefined : "SOURCE_VALUE_MISMATCH",
    };
  },
  async compensate(context, command, payload) {
    const route = config(context).write_routes?.[command.resourceKey];
    if (!route?.compensatePath)
      throw new IntegrationError(
        "يتطلب الأمر تعويضًا يدويًا؛ لم يُعرّف مسار تراجع.",
        "COMPENSATION_REQUIRED",
        false,
      );
    const result = await request(
      context,
      route.compensatePath.replace(
        "{id}",
        encodeURIComponent(command.entityId),
      ),
      {
        method: "POST",
        headers: { "Idempotency-Key": `${command.idempotencyKey}:compensate` },
        body: JSON.stringify(payload),
      },
    );
    return {
      ok: result.response.ok,
      sourceSnapshot: object(result.payload)
        ? (result.payload as JsonObject)
        : {},
    };
  },
};

async function* sync(
  context: ConnectorContext,
  syncRequest: ConnectorSyncRequest,
  incremental: boolean,
): AsyncGenerator<ConnectorBatch> {
  const selected = new Set(syncRequest.streams || []),
    definitions = config(context).streams.filter(
      (stream) => !selected.size || selected.has(stream.key),
    );
  for (const stream of definitions) {
    const url = new URL(stream.path, config(context).base_url),
      checkpoint = context.checkpoints[stream.key];
    if (
      incremental &&
      stream.cursorParam &&
      checkpoint?.cursor !== null &&
      checkpoint?.cursor !== undefined
    )
      url.searchParams.set(stream.cursorParam, String(checkpoint.cursor));
    url.searchParams.set(
      "limit",
      String(Math.min(syncRequest.pageSize || 500, 1000)),
    );
    const result = await request(context, url.pathname + url.search);
    if (!result.response.ok)
      throw new IntegrationError(
        "فشلت قراءة بيانات النظام الخارجي.",
        "SOURCE_ERROR",
        result.response.status >= 500 || result.response.status === 429,
        { stream: stream.key, status: result.response.status },
      );
    const next = getPath(result.payload, stream.nextCursorPath) || null,
      watermark = getPath(result.payload, stream.watermarkPath);
    yield {
      streamKey: stream.key,
      records: records(result.payload, stream.recordsPath),
      nextCursor: next as JsonValue,
      watermark: typeof watermark === "string" ? watermark : null,
      hasMore: Boolean(next),
      sourceRequestId: result.response.headers.get("x-request-id") || undefined,
    };
  }
}
