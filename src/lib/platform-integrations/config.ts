const enabled = (value: string | undefined) => /^(1|true|yes|on)$/i.test(value || '');
const cleanUrl = (value: string | undefined, fallback = '') => (value || fallback).trim().replace(/\/$/, '');

export type DurableWorkerKind = 'integration' | 'orby';

export function platformIntegrationsConfig() {
  const triggerSecretKey = process.env.TRIGGER_SECRET_KEY?.trim() || '';
  const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim() || '';
  const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY?.trim() || '';
  const openMeterApiKey = process.env.OPENMETER_API_KEY?.trim() || '';
  const openMeterBaseUrl = cleanUrl(process.env.OPENMETER_BASE_URL);

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
  };
}

export function platformIntegrationsStatus() {
  const config = platformIntegrationsConfig();
  return {
    trigger: { enabled: config.trigger.enabled, configured: config.trigger.configured },
    langfuse: { enabled: config.langfuse.enabled, configured: config.langfuse.configured, captureContent: config.langfuse.captureContent },
    openMeter: { enabled: config.openMeter.enabled, configured: config.openMeter.configured },
  };
}
