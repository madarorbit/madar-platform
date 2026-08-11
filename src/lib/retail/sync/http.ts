import { SYNC_API_VERSION } from "@/src/lib/retail/sync/contracts";
import { logEvent } from "@/src/lib/retail/logger";
import { authorizeRetailRequest, syncRetailIdentity } from "@/src/lib/retail/server/auth/context";

export async function authenticatedSyncRequest(request: Request, workspaceId: string) {
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) return null;
  const authorization = await authorizeRetailRequest(request, workspaceId);
  if (!authorization) return null;
  await syncRetailIdentity(authorization.principal, authorization.principal);
  return { userId: authorization.principal.id, principal: authorization.principal };
}

export async function readJsonBody(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 262_144) throw new Error("PAYLOAD_TOO_LARGE");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 262_144) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(body) as unknown;
}

export function syncJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-MADAR-Sync-Version": String(SYNC_API_VERSION) },
  });
}

export function syncError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logEvent("error", "sync.request_failed", { error_name: error instanceof Error ? error.name : "unknown", error_code: message.split(":")[0] });
  if (message.includes("PAYLOAD_TOO_LARGE")) return syncJson({ error: "PAYLOAD_TOO_LARGE" }, 413);
  if (message.includes("NOT_AUTHORIZED") || message.includes("DEVICE_NOT_REGISTERED")) return syncJson({ error: "NOT_AUTHORIZED" }, 403);
  if (message.includes("OPERATION_ID_CONFLICT") || message.includes("OPERATION_ALREADY_PROCESSING")) return syncJson({ error: "IDEMPOTENCY_CONFLICT" }, 409);
  if (message.includes("SUBSCRIPTION") || message.includes("WORKSPACE_SUSPENDED")) return syncJson({ error: "WORKSPACE_WRITE_DISABLED" }, 403);
  return syncJson({ error: "OPERATION_REJECTED" }, 422);
}
