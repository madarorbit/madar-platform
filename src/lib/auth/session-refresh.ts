export type RefreshSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type RefreshResult =
  | { kind: "refreshed"; session: RefreshSession }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export function refreshFailureIsTerminal(status: number, payload: unknown) {
  if (status === 401 || status === 403) return true;
  if (status !== 400) return false;
  const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const text = [
    value.code,
    value.error_code,
    value.error,
    value.message,
    value.msg,
    value.error_description,
  ].filter(Boolean).join(" ").toLowerCase();
  return /refresh[_ ]?token|invalid[_ ]?grant|session.*(?:missing|not found|expired)|token.*(?:missing|not found|expired|invalid)/.test(text);
}

export async function refreshSession(
  base: string,
  key: string,
  refreshToken: string,
): Promise<RefreshResult> {
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (
      response.ok &&
      payload &&
      typeof payload.access_token === "string" &&
      typeof payload.refresh_token === "string"
    ) {
      return {
        kind: "refreshed",
        session: {
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
          expires_in: Number(payload.expires_in) || 3600,
        },
      };
    }
    return refreshFailureIsTerminal(response.status, payload)
      ? { kind: "invalid" }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
