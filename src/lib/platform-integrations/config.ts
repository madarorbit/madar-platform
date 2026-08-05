const enabled = (value: string | undefined) => /^(1|true|yes|on)$/i.test(value || '');
const cleanUrl = (value: string | undefined, fallback = '') => (value || fallback).trim().replace(/\/$/, '');
const csv = (value: string | undefined) => (value || '').split(',').map((item) => item.trim()).filter(Boolean);

export type DurableWorkerKind = 'integration' | 'orby';
export type OpenFgaMode = 'shadow' | 'enforce';

export function platformIntegrationsConfig() {
  const triggerSecretKey = process.env.TRIGGER_SECRET_KEY?.trim() || '';
  const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim() || '';
  const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY?.trim() || '';
  const openMeterApiKey = process.env.OPENMETER_API_KEY?.trim() || '';
  const openMeterBaseUrl = cleanUrl(process.env.OPENMETER_BASE_URL);
  const openFgaApiUrl = cleanUrl(process.env.OPENFGA_API_URL);
  const openFgaStoreId = process.env.OPENFGA_STORE_ID?.trim() || '';
  const svixToken = process.env.SVIX_AUTH_TOKEN?.trim() || '';
  const nangoApiKey = process.env.NANGO_API_KEY?.trim() || '';
  const nangoWebhookSigningKey = process.env.NANGO_WEBHOOK_SIGNING_KEY?.trim() || '';
  const openFgaMode: OpenFgaMode = process.env.MADAR_OPENFGA_MODE?.trim().toLowerCase() === 'enforce' ? 'enforce' : 'shadow';

  return {
    trigger: {
      enabled: enabled(process.env.MADAR_TRIGGER_ENABLED),
      configured: Boolean(triggerSecretKey),
      secretKey: triggerSecretKey,
      apiUrl: cleanUrl(process.env.TRIGGER_API_URL, 'https://api.trigger.dev'),
      tasks: {
        integration: process.env.MADAR_TRIGGER_INTEGRATION_TASK_ID?.trim() || 'madar-integration-worker',
        orby: process.env.MADAR_TRIGGER_ORBY_TASK_ID?.trim() || 'madar-orby-worker',
      } satisfies Record<DurableWorkerKind, string>,
      timeoutMs: 2_000,
    },
    langfuse: {
      enabled: enabled(process.env.MADAR_LANGFUSE_ENABLED),
      configured: Boolean(langfusePublicKey && langfuseSecretKey),
      publicKey: langfusePublicKey,
      secretKey: langfuseSecretKey,
      baseUrl: cleanUrl(process.env.LANGFUSE_BASE_URL, 'https://cloud.langfuse.com'),
      captureContent: enabled(process.env.MADAR_OBSERVABILITY_CAPTURE_CONTENT),
      timeoutMs: 1_500,
    },
    openMeter: {
      enabled: enabled(process.env.MADAR_OPENMETER_ENABLED),
      configured: Boolean(openMeterBaseUrl),
      baseUrl: openMeterBaseUrl,
      apiKey: openMeterApiKey,
      eventsPath: process.env.OPENMETER_EVENTS_PATH?.trim() || '/api/v1/events',
      timeoutMs: 1_500,
    },
    openFga: {
      enabled: enabled(process.env.MADAR_OPENFGA_ENABLED),
      configured: Boolean(openFgaApiUrl && openFgaStoreId),
      mode: openFgaMode,
      apiUrl: openFgaApiUrl,
      storeId: openFgaStoreId,
      authorizationModelId: process.env.OPENFGA_AUTHORIZATION_MODEL_ID?.trim() || '',
      apiToken: process.env.OPENFGA_API_TOKEN?.trim() || '',
      timeoutMs: 1_200,
    },
    svix: {
      enabled: enabled(process.env.MADAR_SVIX_ENABLED),
      configured: Boolean(svixToken),
      apiUrl: cleanUrl(process.env.SVIX_API_URL, 'https://api.svix.com'),
      authToken: svixToken,
      timeoutMs: 2_000,
      maxPayloadBytes: 40 * 1024,
    },
    nango: {
      enabled: enabled(process.env.MADAR_NANGO_ENABLED),
      configured: Boolean(nangoApiKey),
      webhookConfigured: Boolean(nangoWebhookSigningKey),
      apiUrl: cleanUrl(process.env.NANGO_API_URL, 'https://api.nango.dev'),
      apiKey: nangoApiKey,
      webhookSigningKey: nangoWebhookSigningKey,
      allowedIntegrations: csv(process.env.MADAR_NANGO_ALLOWED_INTEGRATIONS),
      timeoutMs: 3_000,
    },
  };
}

export function platformIntegrationsStatus() {
  const config = platformIntegrationsConfig();
  return {
    trigger: { enabled: config.trigger.enabled, configured: config.trigger.configured },
    langfuse: { enabled: config.langfuse.enabled, configured: config.langfuse.configured, captureContent: config.langfuse.captureContent },
    openMeter: { enabled: config.openMeter.enabled, configured: config.openMeter.configured },
    openFga: { enabled: config.openFga.enabled, configured: config.openFga.configured, mode: config.openFga.mode },
    svix: { enabled: config.svix.enabled, configured: config.svix.configured },
    nango: { enabled: config.nango.enabled, configured: config.nango.configured, webhookConfigured: config.nango.webhookConfigured },
  };
}
