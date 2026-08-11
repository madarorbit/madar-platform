"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, redirectWithMessage } from "@/src/lib/retail/server/actions";
import { requirePlatformAdmin, syncRetailIdentity } from "@/src/lib/retail/server/auth/context";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";

async function runAdminOperation(user: Awaited<ReturnType<typeof requirePlatformAdmin>>, operation: string, args: Record<string, unknown>) {
  await syncRetailIdentity(user);
  return executeRetailRpc(user.id, operation, args);
}

export async function reviewPaymentAction(formData: FormData) {
  const user = await requirePlatformAdmin();
  const parsed = z.object({ request_id: z.string().uuid(), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() }).safeParse({ request_id: formData.get("request_id"), decision: formData.get("decision"), note: formData.get("note") });
  if (!parsed.success) redirectWithMessage("/admin/retail", "error", "طلب مراجعة غير صالح.");
  try { await runAdminOperation(user, "admin_review_retail_payment", { target_request: parsed.data.request_id, decision: parsed.data.decision, note: parsed.data.note ?? null }); }
  catch (error) { redirectWithMessage("/admin/retail", "error", friendlyError(error)); }
  revalidatePath("/admin/retail"); redirectWithMessage("/admin/retail", "success", "تم حفظ قرار الدفع وتحديث الاشتراك عند الموافقة.");
}

export async function setWorkspaceStatusAction(formData: FormData) {
  const user = await requirePlatformAdmin();
  const parsed = z.object({ workspace_id: z.string().uuid(), status: z.enum(["active", "suspended"]), note: z.string().trim().max(500).optional() }).safeParse({ workspace_id: formData.get("workspace_id"), status: formData.get("status"), note: formData.get("note") });
  if (!parsed.success) redirectWithMessage("/admin/retail", "error", "حالة المساحة غير صالحة.");
  try { await runAdminOperation(user, "admin_set_retail_workspace_status", { target_workspace: parsed.data.workspace_id, target_status: parsed.data.status, note: parsed.data.note ?? null }); }
  catch (error) { redirectWithMessage("/admin/retail", "error", friendlyError(error)); }
  revalidatePath("/admin/retail"); redirectWithMessage("/admin/retail", "success", "تم تحديث حالة المساحة.");
}

export async function upsertPlanAction(formData: FormData) {
  const user = await requirePlatformAdmin();
  const parsed = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{3,60}$/), name_ar: z.string().trim().min(2).max(100), description_ar: z.string().trim().max(500).optional(), price_amount: z.union([z.coerce.number().nonnegative(), z.literal("")]), currency: z.string().regex(/^[A-Z]{3}$/), billing_months: z.coerce.number().int().min(1).max(36), trial_days: z.coerce.number().int().min(0).max(90), grace_days: z.coerce.number().int().min(0).max(30), status: z.enum(["draft", "active", "archived"]), is_public: z.boolean() }).safeParse({ code: formData.get("code"), name_ar: formData.get("name_ar"), description_ar: formData.get("description_ar"), price_amount: formData.get("price_amount"), currency: formData.get("currency"), billing_months: formData.get("billing_months"), trial_days: formData.get("trial_days"), grace_days: formData.get("grace_days"), status: formData.get("status"), is_public: formData.get("is_public") === "on" });
  if (!parsed.success) redirectWithMessage("/admin/retail", "error", "راجع تكوين الخطة وسعرها ومدتها.");
  try { await runAdminOperation(user, "admin_upsert_retail_plan", { payload: { ...parsed.data, price_amount: parsed.data.price_amount === "" ? null : parsed.data.price_amount, features: { dashboard: true, analytics: true, orby_read_only: true, sync_api: true }, limits: { members: 1, products: 500, orby_daily_requests: 30 } } }); }
  catch (error) { redirectWithMessage("/admin/retail", "error", friendlyError(error)); }
  revalidatePath("/admin/retail"); redirectWithMessage("/admin/retail", "success", "تم حفظ الخطة.");
}

export async function upsertPaymentMethodAction(formData: FormData) {
  const user = await requirePlatformAdmin();
  const parsed = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,60}$/), name_ar: z.string().trim().min(2).max(100), kind: z.enum(["LOCAL_WALLET", "BANK_TRANSFER", "MANUAL"]), account_name: z.string().trim().max(120).optional(), account_identifier: z.string().trim().max(120).optional(), instructions_ar: z.string().trim().max(1000).optional(), currency: z.string().regex(/^[A-Z]{3}$/), status: z.enum(["draft", "active", "disabled"]) }).safeParse({ code: formData.get("code"), name_ar: formData.get("name_ar"), kind: formData.get("kind"), account_name: formData.get("account_name"), account_identifier: formData.get("account_identifier"), instructions_ar: formData.get("instructions_ar"), currency: formData.get("currency"), status: formData.get("status") });
  if (!parsed.success) redirectWithMessage("/admin/retail", "error", "راجع بيانات طريقة الدفع المحلية.");
  try { await runAdminOperation(user, "admin_upsert_retail_payment_method", { payload: parsed.data }); }
  catch (error) { redirectWithMessage("/admin/retail", "error", friendlyError(error)); }
  revalidatePath("/admin/retail"); redirectWithMessage("/admin/retail", "success", "تم حفظ طريقة الدفع.");
}
