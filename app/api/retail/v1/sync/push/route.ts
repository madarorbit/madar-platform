import { syncPushSchema, type SyncPush } from "@/src/lib/retail/sync/contracts";
import { authenticatedSyncRequest, readJsonBody, syncError, syncJson } from "@/src/lib/retail/sync/http";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";

const RPC_BY_OPERATION: Record<SyncPush["operation_type"], string> = {
  PRODUCT_CREATE: "retail_create_product",
  PRODUCT_UPDATE: "retail_update_product",
  CATEGORY_UPSERT: "retail_upsert_category",
  CUSTOMER_UPSERT: "retail_upsert_customer",
  SUPPLIER_UPSERT: "retail_upsert_supplier",
  INVENTORY_ADJUST: "retail_adjust_inventory",
  CASH_ADJUST: "retail_adjust_cash",
  SALE_CREATE: "retail_create_sale",
  PURCHASE_CREATE: "retail_create_purchase",
  EXPENSE_CREATE: "retail_create_expense",
  RECEIVABLE_COLLECTION: "retail_collect_receivable",
  PAYABLE_PAYMENT: "retail_pay_payable",
  SALE_RETURN: "retail_record_sale_return",
};

export async function POST(request: Request) {
  try {
    const input = syncPushSchema.parse(await readJsonBody(request));
    const auth = await authenticatedSyncRequest(request, input.workspace_id);
    if (!auth) return syncJson({ error: "AUTHENTICATION_REQUIRED" }, 401);
    const data = await executeRetailRpc(auth.userId, RPC_BY_OPERATION[input.operation_type], {
      target_workspace: input.workspace_id,
      target_operation: input.operation_id,
      payload: input.payload,
      source_device: input.device_id,
    });
    return syncJson({ data });
  } catch (error) {
    return syncError(error);
  }
}
