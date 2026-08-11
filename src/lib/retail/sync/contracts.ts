import { z } from "zod";

export const SYNC_API_VERSION = 1;
const uuid = z.string().uuid();

export const deviceRegistrationSchema = z.object({
  workspace_id: uuid,
  device_id: uuid,
  device_name: z.string().trim().min(1).max(80),
  platform: z.enum(["android", "web"]),
  app_version: z.string().trim().max(40).optional(),
});

export const syncPullSchema = z.object({
  workspace_id: uuid,
  device_id: uuid,
  after_cursor: z.coerce.number().int().nonnegative().default(0),
  page_size: z.coerce.number().int().min(1).max(500).default(250),
});

export const syncOperationTypeSchema = z.enum([
  "PRODUCT_CREATE", "PRODUCT_UPDATE", "CATEGORY_UPSERT", "CUSTOMER_UPSERT",
  "SUPPLIER_UPSERT", "INVENTORY_ADJUST", "CASH_ADJUST", "SALE_CREATE",
  "PURCHASE_CREATE", "EXPENSE_CREATE", "RECEIVABLE_COLLECTION",
  "PAYABLE_PAYMENT", "SALE_RETURN",
]);

export const syncPushSchema = z.object({
  workspace_id: uuid,
  device_id: uuid,
  operation_id: uuid,
  operation_type: syncOperationTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});

export type SyncPush = z.infer<typeof syncPushSchema>;
