import type {
  Connector,
  ConnectorBatch,
  ConnectorManifest,
  JsonObject,
} from "../contracts";

function passive(
  manifest: ConnectorManifest,
  requiredConfig: readonly string[],
): Connector {
  return {
    manifest,
    validateConfig(input) {
      const value =
        input && typeof input === "object" && !Array.isArray(input)
          ? (input as Record<string, unknown>)
          : {};
      const missing = requiredConfig.filter(
        (key) => typeof value[key] !== "string" || !String(value[key]).trim(),
      );
      return missing.length
        ? {
            valid: false,
            issues: missing.map((key) => ({
              path: key,
              message: "هذا الحقل مطلوب.",
            })),
          }
        : { valid: true, normalizedConfig: value as JsonObject };
    },
    async testConnection() {
      return {
        ok: true,
        latencyMs: 0,
        accountLabel: manifest.displayName,
        warnings: ["الاتصال سلبي؛ تبدأ البيانات عند وصول أول تسليم موقّع."],
      };
    },
    async *initialSync(): AsyncGenerator<ConnectorBatch> {},
    async *incrementalSync(): AsyncGenerator<ConnectorBatch> {},
  };
}

export const fileImportConnector = passive(
  {
    key: "madar.file-import",
    version: "2.0.0",
    displayName: "Files & CSV",
    description: "استيراد ملفات مع معاينة ومطابقة.",
    authSchemes: ["none"],
    streams: [],
    capabilities: {
      read: true,
      write: false,
      webhooks: false,
      polling: false,
      files: true,
      database: false,
      localBridge: false,
    },
    channels: ["FILE"],
    supportedVerticals: ["commerce", "food_service", "hospitality"],
    certification: "certified",
  },
  ["format"],
);
export const webhookConnector = passive(
  {
    key: "madar.webhook",
    version: "2.0.0",
    displayName: "Webhooks",
    description: "استقبال أحداث موقعة.",
    authSchemes: ["custom"],
    streams: [],
    capabilities: {
      read: true,
      write: false,
      webhooks: true,
      polling: false,
      files: false,
      database: false,
      localBridge: false,
    },
    channels: ["WEBHOOK"],
    supportedVerticals: ["commerce", "food_service", "hospitality"],
    certification: "certified",
  },
  ["signature_algorithm"],
);
export const localBridgeConnector = passive(
  {
    key: "madar.local-bridge",
    version: "2.0.0",
    displayName: "Local Bridge",
    description: "جسر محلي للأنظمة داخل الشبكة.",
    authSchemes: ["custom"],
    streams: [],
    capabilities: {
      read: true,
      write: true,
      webhooks: true,
      polling: true,
      files: true,
      database: true,
      localBridge: true,
    },
    channels: ["LOCAL_BRIDGE"],
    supportedVerticals: ["commerce", "food_service", "hospitality"],
    certification: "certified",
  },
  ["bridge_name"],
);
export const publicChannelConnectors = [
  genericFile(),
  webhookConnector,
  localBridgeConnector,
] as const;
function genericFile() {
  return fileImportConnector;
}
