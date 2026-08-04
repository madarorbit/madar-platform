export class NetworkTimeoutError extends Error {
  constructor(message = 'انتهت مهلة الاتصال بمَدار. تحقق من الشبكة ثم أعد المحاولة.') {
    super(message);
    this.name = 'NetworkTimeoutError';
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  let timedOut = false;

  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new NetworkTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}
