"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { required } from "@/src/lib/validation";
import { isSupportedCurrency } from "@/src/lib/v2/account";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createIntegrationRuntime } from "@/src/lib/integration/runtime";
import type {
  ConnectorAuthScheme,
  ConnectionMode,
} from "@/src/lib/integration/contracts";

export type V2ActionState = {
  success?: string;
  error?: string;
  entityId?: string;
  secret?: string;
  endpoint?: string;
};
const json = (value: FormDataEntryValue | null, label: string) => {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    throw new Error(`${label} يجب أن يكون JSON صالحًا.`);
  }
};
const rpc = async (name: string, body: Record<string, unknown>) =>
  supabaseFetch(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
const resultId = (value: unknown) =>
  typeof value === "string"
    ? value
    : Array.isArray(value) && typeof value[0] === "string"
      ? value[0]
      : undefined;
async function execute(
  work: (organizationId: string) => Promise<unknown>,
  message: string,
  paths: string[],
): Promise<V2ActionState> {
  try {
    const { workspace } = await requireBusinessWorkspace(),
      value = await work(workspace.id);
    paths.forEach((path) => revalidatePath(path));
    return { success: message, entityId: resultId(value) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر إتمام العملية.",
    };
  }
}

export async function requestConnector(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("request_connector", {
        target_organization: organizationId,
        vendor_name: required(form.get("vendor_name"), "اسم المورّد"),
        system_name: required(form.get("system_name"), "اسم النظام"),
        use_case: required(form.get("use_case"), "حالة الاستخدام"),
        website: String(form.get("website") || "").trim() || null,
        api_documentation_url:
          String(form.get("api_documentation_url") || "").trim() || null,
      }),
    "استلمنا طلب الموصل وسيظهر تقدمه في المركز.",
    ["/workspace/connect"],
  );
}
export async function createWorkspaceConnection(
  _previous: V2ActionState,
  form: FormData,
): Promise<V2ActionState> {
  try {
    const { workspace, membership, user } = await requireBusinessWorkspace();
    if (!["OWNER", "ADMIN"].includes(membership.role))
      throw new Error("تحتاج صلاحية مدير لإنشاء اتصال.");
    const authScheme = String(
        form.get("auth_scheme") || "none",
      ) as ConnectorAuthScheme,
      mode = String(
        form.get("connection_mode") || "READ_ONLY",
      ) as ConnectionMode;
    if (
      ![
        "none",
        "api_key",
        "bearer",
        "basic",
        "oauth2",
        "database",
        "custom",
      ].includes(authScheme) ||
      !["READ_ONLY", "WRITE_LIMITED"].includes(mode)
    )
      throw new Error("إعدادات الاتصال غير صالحة.");
    const connection = await createIntegrationRuntime().connections.create({
      organizationId: workspace.id,
      actorId: user.id,
      connectorKey: required(form.get("connector_key"), "الموصل"),
      name: required(form.get("name"), "اسم الاتصال"),
      authScheme,
      auth: json(form.get("auth"), "بيانات المصادقة"),
      config: json(form.get("config"), "إعدادات الموصل"),
      mode,
    });
    revalidatePath("/workspace/connect");
    return {
      success: "أُنشئ الاتصال ووُضع اختبار الاتصال في الطابور.",
      entityId: connection.id,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر إنشاء الاتصال.",
    };
  }
}
export async function approveMappingPreview(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("approve_mapping_preview", {
        target_organization: organizationId,
        target_preview: required(form.get("preview_id"), "معاينة المطابقة"),
      }),
    "تم اعتماد المطابقة وأصبحت جاهزة للمزامنة الأولى.",
    ["/workspace/connect"],
  );
}
export async function enqueueConnectionSync(
  _previous: V2ActionState,
  form: FormData,
): Promise<V2ActionState> {
  try {
    const { workspace, membership, user } = await requireBusinessWorkspace();
    if (!["OWNER", "ADMIN"].includes(membership.role))
      throw new Error("تحتاج صلاحية مدير لتشغيل المزامنة.");
    const mode = String(form.get("mode") || "initial");
    if (mode !== "initial" && mode !== "incremental")
      throw new Error("نوع المزامنة غير صالح.");
    const job = await createIntegrationRuntime().connections.enqueueSync({
      organizationId: workspace.id,
      connectionId: required(form.get("connection_id"), "الاتصال"),
      actorId: user.id,
      mode,
    });
    revalidatePath("/workspace/connect");
    return {
      success:
        mode === "initial"
          ? "وُضعت المزامنة الأولى في الطابور."
          : "وُضعت المزامنة التزايدية في الطابور.",
      entityId: job.id,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر تشغيل المزامنة.",
    };
  }
}
export async function setConnectionPaused(
  _previous: V2ActionState,
  form: FormData,
): Promise<V2ActionState> {
  try {
    const { workspace, membership, user } = await requireBusinessWorkspace();
    if (!["OWNER", "ADMIN"].includes(membership.role))
      throw new Error("تحتاج صلاحية مدير لإيقاف الاتصال.");
    const paused = String(form.get("paused")) === "true";
    await createIntegrationRuntime().connections.setPaused({
      organizationId: workspace.id,
      connectionId: required(form.get("connection_id"), "الاتصال"),
      actorId: user.id,
      paused,
    });
    revalidatePath("/workspace/connect");
    return {
      success: paused ? "أُوقف الاتصال مؤقتًا." : "أُعيد تنشيط الاتصال.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر تحديث الاتصال.",
    };
  }
}
export async function createInboundEndpoint(
  _previous: V2ActionState,
  form: FormData,
): Promise<V2ActionState> {
  try {
    const { workspace, membership, user } = await requireBusinessWorkspace();
    if (!["OWNER", "ADMIN"].includes(membership.role))
      throw new Error("تحتاج صلاحية مدير لإنشاء نقطة استقبال.");
    const connectionId = required(form.get("connection_id"), "الاتصال"),
      channel = String(form.get("channel") || "WEBHOOK"),
      authMode =
        channel === "WEBHOOK"
          ? String(form.get("auth_mode") || "HMAC_SHA256")
          : "TOKEN";
    if (!["WEBHOOK", "LOCAL_BRIDGE", "FILE"].includes(channel))
      throw new Error("قناة الاستقبال غير صالحة.");
    if (!["TOKEN", "HMAC_SHA256"].includes(authMode))
      throw new Error("طريقة حماية نقطة الاستقبال غير صالحة.");
    const rows = await supabaseFetch(
      `/rest/v1/integration_connections?id=eq.${encodeURIComponent(connectionId)}&organization_id=eq.${encodeURIComponent(workspace.id)}&deleted_at=is.null&select=id&limit=1`,
    );
    if (!rows?.[0]) throw new Error("الاتصال غير موجود في هذه المساحة.");
    const token = randomBytes(32).toString("base64url"),
      endpointKey = randomUUID(),
      runtime = createIntegrationRuntime(),
      encrypted =
        authMode === "HMAC_SHA256"
          ? runtime.secrets.encrypt({ secret: token })
          : null,
      database = runtime.database,
      created = await database.insert<{ id: string }>(
        "integration_inbound_endpoints",
        {
          organization_id: workspace.id,
          connection_id: connectionId,
          endpoint_key: endpointKey,
          channel,
          auth_mode: authMode,
          token_hash: createHash("sha256").update(token).digest("hex"),
          signing_secret_ciphertext: encrypted?.ciphertext || null,
          signing_secret_iv: encrypted?.iv || null,
          signing_secret_auth_tag: encrypted?.authTag || null,
          signing_secret_key_version: encrypted?.keyVersion || null,
          created_by: user.id,
        },
      );
    revalidatePath("/workspace/connect");
    return {
      success:
        authMode === "HMAC_SHA256"
          ? "أُنشئت نقطة الاستقبال. انسخ مفتاح التوقيع الآن؛ لن يظهر مرة أخرى."
          : "أُنشئت نقطة الاستقبال. انسخ الرمز الآن؛ لن يظهر مرة أخرى.",
      entityId: created[0]?.id,
      secret: token,
      endpoint: `/api/integrations/inbound/${endpointKey}`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "تعذر إنشاء نقطة الاستقبال.",
    };
  }
}
export async function grantIntegrationPermission(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("grant_integration_permission", {
        target_organization: organizationId,
        target_connection: required(form.get("connection_id"), "الاتصال"),
        resource_key: required(form.get("resource_key"), "المورد"),
        permission: String(form.get("permission") || "READ"),
        grant_constraints: json(form.get("constraints"), "قيود الصلاحية"),
      }),
    "تم تسجيل الموافقة والصلاحية.",
    ["/workspace/permissions"],
  );
}
export async function revokeConnectionPermissions(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("revoke_connection_permissions", {
        target_organization: organizationId,
        target_connection: required(form.get("connection_id"), "الاتصال"),
      }),
    "أُلغيت الصلاحيات وأُوقفت الأوامر غير المنفذة.",
    ["/workspace/permissions"],
  );
}
export async function previewIntegrationWrite(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("preview_integration_write", {
        target_organization: organizationId,
        target_connection: required(form.get("connection_id"), "الاتصال"),
        command_type: required(form.get("command_type"), "نوع الأمر"),
        resource_key: required(form.get("resource_key"), "المورد"),
        entity_type: required(form.get("entity_type"), "نوع الكيان"),
        entity_id: required(form.get("entity_id"), "معرّف الكيان"),
        desired_change: json(form.get("desired_change"), "التغيير المطلوب"),
        expected_source_version:
          String(form.get("expected_source_version") || "").trim() || null,
        idempotency_key: required(
          form.get("idempotency_key"),
          "مفتاح عدم التكرار",
        ),
      }),
    "تم إنشاء المعاينة. راجعها ثم أكد التنفيذ.",
    ["/workspace/permissions"],
  );
}
export async function confirmIntegrationWrite(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("confirm_integration_write", {
        target_organization: organizationId,
        target_command: required(form.get("command_id"), "الأمر"),
      }),
    "تم التأكيد ووُضع الأمر في طابور التنفيذ والتحقق.",
    ["/workspace/permissions"],
  );
}

export async function createCommercePurchaseOrder(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) => {
      const currency = String(form.get("currency") || "");
      if (!isSupportedCurrency(currency)) throw new Error("العملة غير صالحة.");
      const orderItems = form.get("items")
        ? json(form.get("items"), "بنود أمر الشراء")
        : [
            {
              product_id: required(form.get("product_id"), "المنتج"),
              quantity: Number(form.get("quantity")),
              unit_cost: Number(form.get("unit_cost")),
            },
          ];
      return rpc("create_commerce_purchase_order", {
        target_organization: organizationId,
        target_supplier: String(form.get("supplier_id") || "").trim() || null,
        order_items: orderItems,
        order_currency: currency,
        order_notes: String(form.get("notes") || "").trim() || null,
      });
    },
    "تم إنشاء أمر الشراء وتثبيت التكلفة المتوقعة.",
    ["/workspace/procurement"],
  );
}
export async function receiveCommercePurchase(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) => {
      const receiptItems = form.get("items")
        ? json(form.get("items"), "بنود الاستلام")
        : [
            {
              purchase_order_item_id: required(
                form.get("purchase_order_item_id"),
                "بند أمر الشراء",
              ),
              quantity: Number(form.get("quantity")),
              unit_cost: Number(form.get("unit_cost")),
              batch_number: String(form.get("batch_number") || ""),
              expires_at: String(form.get("expires_at") || ""),
            },
          ];
      return rpc("receive_commerce_purchase", {
        target_organization: organizationId,
        target_purchase_order: required(
          form.get("purchase_order_id"),
          "أمر الشراء",
        ),
        receipt_items: receiptItems,
      });
    },
    "تم الاستلام وتحديث التكلفة المتوسطة والمخزون.",
    ["/workspace/procurement", "/workspace/inventory", "/workspace/analytics"],
  );
}
export async function recordCommerceSalesReturn(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) => {
      const returnItems = form.get("items")
        ? json(form.get("items"), "بنود المرتجع")
        : [
            {
              sale_item_id: required(form.get("sale_item_id"), "بند البيع"),
              quantity: Number(form.get("quantity")),
              restock: form.get("restock") === "on",
            },
          ];
      return rpc("record_commerce_sales_return", {
        target_organization: organizationId,
        target_sale: required(form.get("sale_id"), "عملية البيع"),
        return_items: returnItems,
        return_reason: String(form.get("reason") || "").trim() || null,
      });
    },
    "تم تسجيل المرتجع وتحديث المخزون والربحية.",
    ["/workspace/sales", "/workspace/inventory", "/workspace/analytics"],
  );
}

export async function recordRestaurantOrder(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) => {
      const orderItems = form.get("items")
        ? json(form.get("items"), "وجبات الطلب")
        : [
            {
              recipe_id: required(form.get("recipe_id"), "الوصفة"),
              quantity: Number(form.get("quantity")),
              notes: String(form.get("notes") || ""),
            },
          ];
      return rpc("record_restaurant_order", {
        target_organization: organizationId,
        target_location: required(form.get("location_id"), "الموقع"),
        service_mode: String(form.get("service_mode") || "DINE_IN"),
        order_items: orderItems,
      });
    },
    "أُرسل الطلب إلى المطبخ وخُصمت مكوناته من المخزون.",
    ["/workspace/restaurant", "/workspace/inventory", "/workspace/analytics"],
  );
}
export async function updateKitchenTicket(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("update_kitchen_ticket", {
        target_organization: organizationId,
        target_ticket: required(form.get("ticket_id"), "تذكرة المطبخ"),
        next_status: required(form.get("next_status"), "الحالة"),
      }),
    "تم تحديث حالة التذكرة والطلب.",
    ["/workspace/restaurant"],
  );
}
export async function createRestaurantRecipe(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) => {
      const ingredients = form.get("ingredients")
        ? json(form.get("ingredients"), "مكونات الوصفة")
        : [
            {
              product_id: required(form.get("product_id"), "المكوّن"),
              quantity: Number(form.get("ingredient_quantity")),
              waste_percent: Number(form.get("waste_percent") || 0),
            },
          ];
      return rpc("create_restaurant_recipe", {
        target_organization: organizationId,
        recipe_name: required(form.get("name"), "اسم الوصفة"),
        recipe_code: required(form.get("code"), "رمز الوصفة"),
        menu_price: Number(form.get("menu_price")),
        yield_quantity: Number(form.get("yield_quantity") || 1),
        preparation_minutes: Number(form.get("preparation_minutes") || 0),
        ingredients,
      });
    },
    "تم إنشاء الوصفة وربطها بالمكونات والتكلفة.",
    ["/workspace/restaurant"],
  );
}

export async function createHotelReservation(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("create_hotel_reservation", {
        target_organization: organizationId,
        target_property: required(form.get("property_id"), "المنشأة"),
        target_rate: required(form.get("rate_id"), "السعر"),
        target_room: String(form.get("room_id") || "").trim() || null,
        guest_name: required(form.get("guest_name"), "اسم النزيل"),
        guest_phone: String(form.get("guest_phone") || "").trim() || null,
        guest_email: String(form.get("guest_email") || "").trim() || null,
        check_in_date: required(form.get("check_in_date"), "تاريخ الوصول"),
        check_out_date: required(form.get("check_out_date"), "تاريخ المغادرة"),
        adults: Number(form.get("adults") || 1),
        children: Number(form.get("children") || 0),
      }),
    "تم إنشاء الحجز وتحديث التوفر.",
    ["/workspace/hotel", "/workspace/analytics"],
  );
}
export async function checkInHotelReservation(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("check_in_hotel_reservation", {
        target_organization: organizationId,
        target_reservation: required(form.get("reservation_id"), "الحجز"),
        target_room: String(form.get("room_id") || "").trim() || null,
      }),
    "تم تسجيل الدخول وفتح إقامة وحساب للنزيل.",
    ["/workspace/hotel"],
  );
}
export async function checkOutHotelStay(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("check_out_hotel_stay", {
        target_organization: organizationId,
        target_stay: required(form.get("stay_id"), "الإقامة"),
        payment_amount: Number(form.get("payment_amount") || 0),
      }),
    "تمت المغادرة، أُغلق الحساب وأُنشئت مهمة تنظيف الغرفة.",
    ["/workspace/hotel", "/workspace/analytics"],
  );
}
export async function createHotelRoomRate(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("create_hotel_room_rate", {
        target_organization: organizationId,
        target_property: required(form.get("property_id"), "المنشأة"),
        room_number: required(form.get("room_number"), "رقم الغرفة"),
        room_type: required(form.get("room_type"), "نوع الغرفة"),
        capacity: Number(form.get("capacity") || 1),
        rate_code: required(form.get("rate_code"), "رمز السعر"),
        rate_name: required(form.get("rate_name"), "اسم السعر"),
        currency: required(form.get("currency"), "العملة"),
        nightly_amount: Number(form.get("nightly_amount")),
      }),
    "تم إنشاء الغرفة والسعر وفتح التوفر للسنة القادمة.",
    ["/workspace/hotel"],
  );
}
export async function updateHousekeepingTask(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("update_housekeeping_task", {
        target_organization: organizationId,
        target_task: required(form.get("task_id"), "مهمة التنظيف"),
        next_status: required(form.get("next_status"), "الحالة"),
        task_notes: String(form.get("notes") || "").trim() || null,
      }),
    "تم تحديث مهمة التنظيف وحالة الغرفة.",
    ["/workspace/hotel"],
  );
}
export async function manageHotelMaintenance(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("manage_hotel_maintenance", {
        target_organization: organizationId,
        target_room: String(form.get("room_id") || "").trim() || null,
        request_title: String(form.get("title") || "").trim() || null,
        request_description:
          String(form.get("description") || "").trim() || null,
        request_priority: String(form.get("priority") || "NORMAL"),
        target_request:
          String(form.get("maintenance_request_id") || "").trim() || null,
        next_status: String(form.get("next_status") || "").trim() || null,
      }),
    form.get("maintenance_request_id")
      ? "تم تحديث طلب الصيانة وحالة الغرفة."
      : "تم فتح طلب الصيانة وتقييم حالة الغرفة.",
    ["/workspace/hotel", "/workspace/analytics"],
  );
}
export async function postHotelFolioCharge(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) =>
      rpc("post_hotel_folio_charge", {
        target_organization: organizationId,
        target_folio: required(form.get("folio_id"), "حساب النزيل"),
        charge_type: required(form.get("charge_type"), "نوع الرسم"),
        description: required(form.get("description"), "الوصف"),
        amount: Number(form.get("amount")),
      }),
    "أُضيف الرسم إلى حساب النزيل.",
    ["/workspace/hotel", "/workspace/analytics"],
  );
}

export async function completeV2Setup(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    async (organizationId) => {
      const answers = Object.fromEntries(
        [...form.entries()]
          .filter(([key]) => key.startsWith("answer:"))
          .map(([key, value]) => {
            const raw = String(value);
            try {
              return [key.slice(7), JSON.parse(raw)];
            } catch {
              return [key.slice(7), raw];
            }
          }),
      );
      const currency = String(form.get("currency") || "");
      if (!isSupportedCurrency(currency)) throw new Error("العملة غير صالحة.");
      await supabaseFetch(
        `/rest/v1/organizations?id=eq.${encodeURIComponent(organizationId)}`,
        { method: "PATCH", body: JSON.stringify({ currency }) },
      );
      return rpc("complete_v2_setup", {
        target_organization: organizationId,
        answers,
      });
    },
    "اكتمل إعداد النشاط وأصبحت لوحة القطاع جاهزة.",
    ["/workspace/setup", "/workspace", "/dashboard"],
  );
}

export async function changeV2Subscription(
  _previous: V2ActionState,
  form: FormData,
) {
  return execute(
    (organizationId) => {
      const currency = String(form.get("currency") || "");
      if (!isSupportedCurrency(currency)) throw new Error("العملة غير صالحة.");
      return rpc("change_v2_subscription", {
        target_organization: organizationId,
        target_variant: required(form.get("variant_id"), "الباقة"),
        target_currency: currency,
      });
    },
    "سُجل تغيير الباقة؛ الترقية فورية والخفض يبدأ في الدورة التالية.",
    ["/account/subscription", "/workspace"],
  );
}
