"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { validateImageUpload } from "@/src/lib/retail/files/validate-upload";
import { createClient } from "@/src/lib/retail/supabase/server";
import { friendlyError } from "@/src/lib/retail/server/actions";
import { requireUser, syncRetailIdentity } from "@/src/lib/retail/server/auth/context";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";

function go(step: number, kind?: "error" | "success", message?: string): never {
  const suffix = kind && message ? `&${kind}=${encodeURIComponent(message)}` : "";
  redirect(`/retail/onboarding?step=${step}${suffix}`);
}

function requireOnboardingManager(user: Awaited<ReturnType<typeof requireUser>>) {
  if (user.platformMembershipRole === "MEMBER") {
    go(1, "error", "مالك مساحة مَدار أو مديرها فقط يمكنه إنشاء مساحة Retail.");
  }
}

export async function saveTradeDetailsAction(formData: FormData) {
  const user = await requireUser();
  requireOnboardingManager(user);
  await syncRetailIdentity(user);
  const parsed = z.object({
    trade_name: z.string().trim().min(2).max(120),
    owner_name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(40).optional(),
    city: z.string().trim().max(80).optional(),
    country: z.string().trim().length(2),
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
  }).safeParse({
    trade_name: formData.get("trade_name"), owner_name: formData.get("owner_name"),
    phone: formData.get("phone"), city: formData.get("city"),
    country: formData.get("country"), currency: formData.get("currency"),
  });
  if (!parsed.success) go(1, "error", "راجع اسم التجارة وبيانات الاتصال.");

  const supabase = await createClient();
  const { data: draft, error } = await supabase
    .from("onboarding_drafts")
    .upsert({
      user_id: user.id,
      platform_organization_id: user.platformOrganizationId,
      current_step: 2,
      ...parsed.data,
    }, { onConflict: "user_id" })
    .select("reserved_workspace_id,logo_path")
    .single();
  if (error || !draft) go(1, "error", friendlyError(error));

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    try {
      const detected = await validateImageUpload(logo);
      const path = `${draft.reserved_workspace_id}/logo-${crypto.randomUUID()}.${detected.extension}`;
      const { error: uploadError } = await supabase.storage
        .from("workspace-assets")
        .upload(path, logo, { contentType: detected.mime, upsert: false });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase
        .from("onboarding_drafts")
        .update({ logo_path: path })
        .eq("user_id", user.id);
      if (updateError) {
        await supabase.storage.from("workspace-assets").remove([path]);
        throw updateError;
      }
    } catch {
      go(1, "error", "الشعار يجب أن يكون JPG أو PNG أو WebP وبحجم لا يتجاوز 5MB.");
    }
  }
  go(2);
}

export async function saveRetailTypeAction(formData: FormData) {
  const user = await requireUser();
  requireOnboardingManager(user);
  await syncRetailIdentity(user);
  const subtype = z.enum(["CLOTHING", "PERFUME", "GROCERY", "ELECTRONICS", "ACCESSORIES", "SPARE_PARTS", "GENERAL_RETAIL", "OTHER"]).safeParse(formData.get("subtype"));
  if (!subtype.success) go(2, "error", "اختر نوع نشاط التجزئة.");
  const supabase = await createClient();
  const { error } = await supabase.from("onboarding_drafts").update({ subtype: subtype.data, current_step: 3 }).eq("user_id", user.id);
  if (error) go(2, "error", friendlyError(error));
  go(3);
}

export async function saveTradeSettingsAction(formData: FormData) {
  const user = await requireUser();
  requireOnboardingManager(user);
  await syncRetailIdentity(user);
  const parsed = z.object({
    price_display: z.enum(["simple", "tax_inclusive"]),
    allow_credit_sales: z.boolean(),
    invoice_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,8}$/),
  }).safeParse({
    price_display: formData.get("price_display"),
    allow_credit_sales: formData.get("allow_credit_sales") === "on",
    invoice_prefix: formData.get("invoice_prefix"),
  });
  if (!parsed.success) go(3, "error", "راجع إعدادات الأسعار والفاتورة.");
  const supabase = await createClient();
  const { error } = await supabase.from("onboarding_drafts").update({ ...parsed.data, inventory_policy: "prevent_negative", current_step: 4 }).eq("user_id", user.id);
  if (error) go(3, "error", friendlyError(error));
  go(4);
}

export async function savePlanAction(formData: FormData) {
  const user = await requireUser();
  requireOnboardingManager(user);
  await syncRetailIdentity(user);
  const planId = z.string().uuid().safeParse(formData.get("plan_id"));
  if (!planId.success) go(4, "error", "اختر خطة متاحة.");
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("id").eq("id", planId.data).eq("status", "active").eq("is_public", true).maybeSingle();
  if (!plan) go(4, "error", "الخطة لم تعد متاحة.");
  const { error } = await supabase.from("onboarding_drafts").update({ selected_plan_id: planId.data, current_step: 5 }).eq("user_id", user.id);
  if (error) go(4, "error", friendlyError(error));
  go(5);
}

export async function completeOnboardingAction(formData: FormData) {
  const user = await requireUser();
  requireOnboardingManager(user);
  await syncRetailIdentity(user);
  const operation = z.string().uuid().safeParse(formData.get("operation_id"));
  try {
    await executeRetailRpc(user.id, "complete_retail_onboarding", {
      target_operation: operation.success ? operation.data : crypto.randomUUID(),
      platform_organization_id: user.platformOrganizationId,
      retail_role: user.retailRole,
    });
  } catch (error) {
    go(5, "error", friendlyError(error));
  }
  redirect("/retail/workspace?success=" + encodeURIComponent("أصبحت مساحة تجارتك جاهزة."));
}
