import { syncPullSchema } from "@/src/lib/retail/sync/contracts";
import { authenticatedSyncRequest, readJsonBody, syncError, syncJson } from "@/src/lib/retail/sync/http";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";

export async function POST(request: Request) {
  try {
    const input = syncPullSchema.parse(await readJsonBody(request));
    const auth = await authenticatedSyncRequest(request, input.workspace_id);
    if (!auth) return syncJson({ error: "AUTHENTICATION_REQUIRED" }, 401);
    const data = await executeRetailRpc(auth.userId, "pull_retail_sync_changes", {
      target_workspace: input.workspace_id,
      target_device: input.device_id,
      after_cursor: input.after_cursor,
      page_size: input.page_size,
    });
    return syncJson({ data });
  } catch (error) {
    return syncError(error);
  }
}
