"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { required } from "@/src/lib/validation";

export async function updateVerticalAvailability(form: FormData) {
  await requireAdmin();
  const id = required(form.get("id"), "النشاط"),
    status = String(form.get("status") || "draft"),
    visible = form.get("is_visible") === "on",
    launch = form.get("launch_enabled") === "on";
  if (!["draft", "approved", "retired"].includes(status))
    throw new Error("حالة النشاط غير صالحة.");
  if (launch) {
    const bindings = await supabaseFetch(
      `/rest/v1/activity_specialization_packages?specialization_id=eq.${encodeURIComponent(id)}&select=package_id,sector_packages(sector_package_versions(status))`,
    );
    const certified =
      bindings?.length &&
      bindings.every(
        (binding: {
          sector_packages?: {
            sector_package_versions?: Array<{ status: string }>;
          };
        }) =>
          binding.sector_packages?.sector_package_versions?.some(
            (version) => version.status === "certified",
          ),
      );
    if (!certified)
      throw new Error("لا يمكن إظهار نشاط قبل اعتماد كل حزمه القطاعية.");
  }
  await supabaseFetch(
    `/rest/v1/activity_specializations?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        is_visible: visible,
        launch_enabled: launch && status === "approved",
      }),
    },
  );
  revalidatePath("/admin/verticals");
  revalidatePath("/register");
}

export async function createVerticalSpecialization(form: FormData) {
  await requireAdmin();
  const typeId = required(form.get("activity_type_id"), "نوع النشاط"),
    packageId = required(form.get("package_id"), "الحزمة"),
    code = required(form.get("code"), "رمز النشاط")
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_"),
    name = required(form.get("name_ar"), "اسم النشاط");
  if (code.length < 3) throw new Error("رمز النشاط قصير.");
  const created = await supabaseFetch("/rest/v1/activity_specializations", {
    method: "POST",
    body: JSON.stringify({
      activity_type_id: typeId,
      code,
      name_ar: name,
      description: String(form.get("description") || "").trim() || null,
      terminology: {},
      default_kpis: [],
      is_visible: false,
      launch_enabled: false,
      status: "draft",
    }),
  });
  const id = created?.[0]?.id;
  if (!id) throw new Error("تعذر إنشاء النشاط.");
  await supabaseFetch("/rest/v1/activity_specialization_packages", {
    method: "POST",
    body: JSON.stringify({
      specialization_id: id,
      package_id: packageId,
      is_required: true,
    }),
  });
  revalidatePath("/admin/verticals");
}

export async function updatePackageVersion(form: FormData) {
  await requireAdmin();
  const id = required(form.get("id"), "إصدار الحزمة"),
    status = String(form.get("status"));
  if (!["draft", "certified", "retired"].includes(status))
    throw new Error("حالة الإصدار غير صالحة.");
  await supabaseFetch(
    `/rest/v1/sector_package_versions?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        certified_at: status === "certified" ? new Date().toISOString() : null,
      }),
    },
  );
  revalidatePath("/admin/verticals");
}
