"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validatePaymentProof } from "@/src/lib/retail/files/validate-upload";
import { createClient } from "@/src/lib/retail/supabase/server";
import { friendlyError, redirectWithMessage } from "@/src/lib/retail/server/actions";
import {
  authorizeRetailCapability,
  requireWorkspace,
  syncRetailIdentity,
} from "@/src/lib/retail/server/auth/context";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";
import { supabaseFetch } from "@/src/lib/supabase/server";

export async function updateProfileAction(formData: FormData) {
  const { user } = await requireWorkspace();
  const parsed = z.object({ full_name: z.string().trim().min(2).max(100), phone: z.string().trim().max(40).optional() }).safeParse({ full_name: formData.get("full_name"), phone: formData.get("phone") });
  if (!parsed.success) redirectWithMessage("/retail/workspace/settings", "error", "راجع الاسم والهاتف.");
  try {
    await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ full_name: parsed.data.full_name, phone: parsed.data.phone || null }),
    });
    await syncRetailIdentity(
      { ...user, fullName: parsed.data.full_name, phone: parsed.data.phone || null },
      user,
    );
  } catch (error) {
    redirectWithMessage("/retail/workspace/settings", "error", friendlyError(error));
  }
  revalidatePath("/retail/workspace/settings");
  redirectWithMessage("/retail/workspace/settings", "success", "تم تحديث الملف الشخصي.");
}

export async function updateWorkspaceSettingsAction(formData: FormData) {
  const { workspace, user } = await requireWorkspace();
  const parsed = z.object({ name: z.string().trim().min(2).max(120), owner_name: z.string().trim().max(100).optional(), phone: z.string().trim().max(40).optional(), city: z.string().trim().max(80).optional(), invoice_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,8}$/), price_display: z.enum(["simple", "tax_inclusive"]), allow_credit_sales: z.boolean() }).safeParse({ name: formData.get("name"), owner_name: formData.get("owner_name"), phone: formData.get("phone"), city: formData.get("city"), invoice_prefix: formData.get("invoice_prefix"), price_display: formData.get("price_display"), allow_credit_sales: formData.get("allow_credit_sales") === "on" });
  if (!parsed.success) redirectWithMessage("/retail/workspace/settings", "error", "راجع إعدادات التجارة والفواتير.");
  try {
    await syncRetailIdentity(user, user);
    await executeRetailRpc(user.id, "retail_update_workspace_settings", { target_workspace: workspace.id, payload: parsed.data });
  } catch (error) {
    redirectWithMessage("/retail/workspace/settings", "error", friendlyError(error));
  }
  revalidatePath("/retail/workspace/settings"); revalidatePath("/retail/workspace");
  redirectWithMessage("/retail/workspace/settings", "success", "تم تحديث إعدادات التجارة.");
}

export async function submitPaymentRequestAction(formData: FormData) {
  const { workspace, role, user } = await requireWorkspace();
  if (!(await authorizeRetailCapability(user, "can_manage_billing", role === "OWNER"))) {
    redirectWithMessage("/retail/workspace/settings", "error", "مالك التجارة المخوّل فقط يمكنه إرسال طلب الدفع.");
  }
  const parsed = z.object({ plan_id: z.string().uuid(), payment_method_id: z.string().uuid(), amount: z.coerce.number().nonnegative(), payment_reference: z.string().trim().min(3).max(120), operation_id: z.string().uuid() }).safeParse({ plan_id: formData.get("plan_id"), payment_method_id: formData.get("payment_method_id"), amount: formData.get("amount"), payment_reference: formData.get("payment_reference"), operation_id: formData.get("operation_id") });
  const proof = formData.get("proof");
  if (!parsed.success || !(proof instanceof File) || proof.size < 1) redirectWithMessage("/retail/workspace/settings", "error", "أكمل بيانات الدفع وأرفق إثباتًا صالحًا.");
  const supabase = await createClient();
  let proofPath: string | null = null;
  try {
    const detected = await validatePaymentProof(proof);
    proofPath = `${workspace.id}/payments/${parsed.data.operation_id}.${detected.extension}`;
    const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(proofPath, proof, { contentType: detected.mime, upsert: false });
    if (uploadError) throw uploadError;
    await syncRetailIdentity(user, user);
    await executeRetailRpc(user.id, "retail_submit_payment_request", {
      target_workspace: workspace.id,
      target_operation: parsed.data.operation_id,
      payload: {
        plan_id: parsed.data.plan_id,
        payment_method_id: parsed.data.payment_method_id,
        amount: parsed.data.amount,
        payment_reference: parsed.data.payment_reference,
        proof_path: proofPath,
        proof_filename: proof.name.slice(0, 200),
        proof_mime_type: detected.mime,
        proof_size_bytes: proof.size,
      },
    });
  } catch (error) {
    if (proofPath) await supabase.storage.from("payment-proofs").remove([proofPath]);
    redirectWithMessage("/retail/workspace/settings", "error", friendlyError(error));
  }
  revalidatePath("/retail/workspace/settings");
  redirectWithMessage("/retail/workspace/settings", "success", "تم إرسال إثبات الدفع للمراجعة.");
}
