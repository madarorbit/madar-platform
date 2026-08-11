"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/src/lib/auth";
import { supabaseConfig } from "@/src/lib/env";
import { validateMagicBytes } from "@/src/lib/file-signatures.mjs";
import { activateApprovedRetailService } from "@/src/lib/retail/server/service-activation";
import { isServiceCode, type ServiceCode } from "@/src/lib/services/catalog";
import { serverToken, supabaseFetch } from "@/src/lib/supabase/server";

export type ServiceActionState = { error?: string; success?: string };

const serviceLabels: Record<ServiceCode, string> = {
  CONNECT_EXISTING: "ربط التجارة القائمة",
  BUILD_ON_MADAR: "بناء التجارة على مَدار",
  MADAR_RETAIL: "MADAR Retail",
};

function plainText(form: FormData, key: string, maximum = 500) {
  return String(form.get(key) || "").trim().slice(0, maximum);
}

function commonSetup(form: FormData) {
  return {
    trade_name: plainText(form, "trade_name", 120),
    owner_name: plainText(form, "owner_name", 100),
    phone: plainText(form, "phone", 40),
    city: plainText(form, "city", 80),
    country: plainText(form, "country", 2) || "YE",
    currency: plainText(form, "currency", 3).toUpperCase() || "YER",
  };
}

function setupForService(code: ServiceCode, form: FormData) {
  const common = commonSetup(form);
  if (code === "MADAR_RETAIL") {
    return z.object({
      trade_name: z.string().min(2).max(120),
      owner_name: z.string().max(100),
      phone: z.string().max(40),
      city: z.string().max(80),
      country: z.string().length(2),
      currency: z.enum(["YER", "SAR", "USD"]),
      subtype: z.enum(["CLOTHING", "PERFUME", "GROCERY", "ELECTRONICS", "ACCESSORIES", "SPARE_PARTS", "GENERAL_RETAIL", "OTHER"]),
      price_display: z.enum(["simple", "tax_inclusive"]),
      invoice_prefix: z.string().regex(/^[A-Z0-9-]{1,8}$/),
      allow_credit_sales: z.boolean(),
    }).parse({
      ...common,
      subtype: plainText(form, "subtype", 40).toUpperCase() || "GENERAL_RETAIL",
      price_display: plainText(form, "price_display", 30) || "simple",
      invoice_prefix: plainText(form, "invoice_prefix", 8).toUpperCase() || "MR",
      allow_credit_sales: form.get("allow_credit_sales") === "on",
    });
  }
  if (code === "CONNECT_EXISTING") {
    return z.object({
      trade_name: z.string().min(2).max(120),
      owner_name: z.string().max(100),
      phone: z.string().max(40),
      city: z.string().max(80),
      country: z.string().length(2),
      currency: z.enum(["YER", "SAR", "USD"]),
      external_system_name: z.string().min(2).max(120),
      vendor_name: z.string().max(120),
      website: z.union([z.literal(""), z.url().max(300)]),
      connection_scope: z.enum(["READ_ONLY", "WRITE_LIMITED"]),
    }).parse({
      ...common,
      external_system_name: plainText(form, "external_system_name", 120),
      vendor_name: plainText(form, "vendor_name", 120),
      website: plainText(form, "website", 300),
      connection_scope: plainText(form, "connection_scope", 30) || "READ_ONLY",
    });
  }
  return z.object({
    trade_name: z.string().min(2).max(120),
    owner_name: z.string().max(100),
    phone: z.string().max(40),
    city: z.string().max(80),
    country: z.string().length(2),
    currency: z.enum(["YER", "SAR", "USD"]),
    specialization_code: z.string().regex(/^[A-Z0-9_]{3,80}$/),
  }).parse({
    ...common,
    specialization_code: plainText(form, "specialization_code", 80).toUpperCase(),
  });
}

async function uploadServiceLogo(file: File, userId: string, code: ServiceCode) {
  if (!file.size) return null;
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[file.type];
  if (!extension || file.size > 5 * 1024 * 1024 || !(await validateMagicBytes(file))) {
    throw new Error("الشعار يجب أن يكون JPG أو PNG أو WebP صالحًا وبحجم لا يتجاوز 5MB.");
  }
  const path = `${userId}/${code.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
  const { url, key } = supabaseConfig();
  const token = await serverToken();
  const response = await fetch(`${url}/storage/v1/object/service-assets/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: file,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("تعذر رفع شعار الخدمة.");
  return path;
}

async function removeServiceLogo(path: string | null) {
  if (!path) return;
  try {
    const { url, key } = supabaseConfig();
    const token = await serverToken();
    await fetch(`${url}/storage/v1/object/service-assets/${path}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {}
}

export async function createServiceRequest(form: FormData) {
  const user = await requireUser();
  const rawCode = plainText(form, "service_code", 40).toUpperCase();
  if (!isServiceCode(rawCode)) redirect("/account?error=service");
  let logoPath: string | null = null;
  let requestId = "";
  try {
    const setup = setupForService(rawCode, form) as Record<string, unknown>;
    const logo = form.get("logo");
    if (logo instanceof File && logo.size) {
      logoPath = await uploadServiceLogo(logo, user.id, rawCode);
      setup.logo_path = logoPath;
    }
    const result = await supabaseFetch("/rest/v1/rpc/create_service_request", {
      method: "POST",
      body: JSON.stringify({ requested_service: rawCode, requested_setup: setup }),
    });
    const row = Array.isArray(result) ? result[0] : result;
    requestId = String(row?.id || "");
    if (!requestId) throw new Error("تعذر إنشاء طلب الخدمة.");
  } catch (error) {
    unstable_rethrow(error);
    await removeServiceLogo(logoPath);
    const message = error instanceof z.ZodError
      ? "راجع بيانات التجارة والحقول المطلوبة."
      : error instanceof Error ? error.message : "تعذر إنشاء طلب الخدمة.";
    redirect(`/account/services/${rawCode}/setup?error=${encodeURIComponent(message)}`);
  }
  redirect(`/workspace-payment/${requestId}`);
}

type ReviewRequest = {
  id: string;
  user_id: string;
  service_code: ServiceCode;
  status: string;
  onboarding_state: string;
  organization_id: string | null;
  setup_payload: Record<string, unknown>;
};

export async function reviewServiceRequest(
  _previous: ServiceActionState,
  form: FormData,
): Promise<ServiceActionState> {
  try {
    await requireAdmin();
    const requestId = plainText(form, "request_id", 60);
    const decision = plainText(form, "decision", 20);
    const reason = plainText(form, "reason", 500) || null;
    if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["approve", "reject"].includes(decision)) {
      throw new Error("قرار المراجعة غير صالح.");
    }
    let request = ((await supabaseFetch(
      `/rest/v1/workspace_requests?id=eq.${encodeURIComponent(requestId)}&select=id,user_id,service_code,status,onboarding_state,organization_id,setup_payload&limit=1`,
    ))?.[0] || null) as ReviewRequest | null;
    if (!request) throw new Error("طلب الخدمة غير موجود.");

    if (request.status === "pending_review") {
      const result = await supabaseFetch("/rest/v1/rpc/review_service_request", {
        method: "POST",
        body: JSON.stringify({ target_request: requestId, decision, reason }),
      });
      request = (Array.isArray(result) ? result[0] : result) as ReviewRequest;
    } else if (!(decision === "approve" && request.service_code === "MADAR_RETAIL" && request.onboarding_state === "PROVISIONING")) {
      throw new Error("هذا الطلب لم يعد قابلًا للمراجعة.");
    }

    if (decision === "approve" && request.service_code === "MADAR_RETAIL") {
      const [profileRows, subscriptionRows] = await Promise.all([
        supabaseFetch(
          `/rest/v1/profiles?id=eq.${encodeURIComponent(request.user_id)}&select=id,email,full_name,phone,role&limit=1`,
        ),
        supabaseFetch(
          `/rest/v1/workspace_subscriptions?user_id=eq.${encodeURIComponent(request.user_id)}&service_code=eq.MADAR_RETAIL&select=id,organization_id,ends_at,grace_ends_at&limit=1`,
        ),
      ]);
      const profile = profileRows?.[0];
      const subscription = subscriptionRows?.[0];
      if (!profile || !subscription || !request.organization_id) {
        throw new Error("اعتمد الدفع لكن تعذر العثور على سياق تهيئة Retail.");
      }
      const workspaceId = await activateApprovedRetailService({
        identity: {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          phone: profile.phone,
          platformRole: ["ADMIN", "SUPER_ADMIN"].includes(profile.role) ? profile.role : "CUSTOMER",
        },
        platformOrganizationId: request.organization_id,
        platformRequestId: request.id,
        setup: request.setup_payload || {},
        endsAt: subscription.ends_at,
        graceEndsAt: subscription.grace_ends_at,
      });
      await supabaseFetch("/rest/v1/rpc/finalize_retail_service_activation", {
        method: "POST",
        body: JSON.stringify({ target_request: request.id, retail_workspace: workspaceId }),
      });
    }

    revalidatePath("/admin/workspace-requests");
    revalidatePath("/admin/local-payments");
    revalidatePath("/admin/users");
    revalidatePath("/account");
    return { success: decision === "approve" ? "تم اعتماد الطلب وتفعيل الخدمة." : "تم رفض الطلب وتسجيل السبب." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر مراجعة طلب الخدمة." };
  }
}

export async function saveServicePlan(form: FormData) {
  await requireAdmin();
  const code = plainText(form, "service_code", 40).toUpperCase();
  const price = Number(form.get("price"));
  const billingMonths = Number(form.get("billing_months"));
  const graceDays = Number(form.get("grace_days"));
  const currency = plainText(form, "currency", 3).toUpperCase();
  if (!isServiceCode(code) || !Number.isFinite(price) || price < 0 || !Number.isInteger(billingMonths) || billingMonths < 1 || billingMonths > 36 || !Number.isInteger(graceDays) || graceDays < 0 || graceDays > 60 || !["YER", "SAR", "USD"].includes(currency)) {
    redirect("/admin/local-payments?error=" + encodeURIComponent("إعدادات السعر غير صالحة."));
  }
  await supabaseFetch(`/rest/v1/subscription_plans?service_code=eq.${code}`, {
    method: "PATCH",
    body: JSON.stringify({
      price,
      currency,
      billing_months: billingMonths,
      grace_days: graceDays,
      is_available: form.get("is_available") === "true",
    }),
  });
  revalidatePath("/admin/local-payments");
  revalidatePath("/account");
  redirect("/admin/local-payments?success=" + encodeURIComponent(`تم تحديث سعر ${serviceLabels[code]}.`));
}

export async function setServiceSubscriptionState(form: FormData) {
  await requireAdmin();
  const subscriptionId = plainText(form, "subscription_id", 60);
  const requestedState = plainText(form, "requested_state", 20).toUpperCase();
  if (!/^[0-9a-f-]{36}$/i.test(subscriptionId) || !["ACTIVE", "SUSPENDED", "EXPIRED"].includes(requestedState)) {
    redirect("/admin/users?error=" + encodeURIComponent("حالة الخدمة غير صالحة."));
  }
  await supabaseFetch("/rest/v1/rpc/set_service_subscription_state", {
    method: "POST",
    body: JSON.stringify({
      target_subscription: subscriptionId,
      requested_state: requestedState,
      reason: plainText(form, "reason", 500) || null,
    }),
  });
  revalidatePath("/admin/users");
  revalidatePath("/account");
  redirect("/admin/users?success=" + encodeURIComponent("تم تحديث حالة الخدمة وتسجيل الإجراء."));
}
