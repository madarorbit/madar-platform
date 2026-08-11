import { deviceRegistrationSchema } from "@/src/lib/retail/sync/contracts";
import { authenticatedSyncRequest, readJsonBody, syncError, syncJson } from "@/src/lib/retail/sync/http";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";

export async function POST(request: Request) {
  try {
    const input = deviceRegistrationSchema.parse(await readJsonBody(request));
    const auth = await authenticatedSyncRequest(request, input.workspace_id);
    if (!auth) return syncJson({ error: "AUTHENTICATION_REQUIRED" }, 401);
    const data = await executeRetailRpc(auth.userId, "register_retail_sync_device", {
      target_workspace: input.workspace_id,
      target_device: input.device_id,
      device_name: input.device_name,
      platform_name: input.platform,
      app_version_value: input.app_version ?? null,
    });
    return syncJson({ data });
  } catch (error) {
    return syncError(error);
  }
}
