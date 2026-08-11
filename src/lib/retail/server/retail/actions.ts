"use server";

import { revalidatePath } from "next/cache";
import {
  expenseInputSchema,
  inventoryAdjustmentSchema,
  partyInputSchema,
  productInputSchema,
  purchaseInputSchema,
  saleInputSchema,
  settlementSchema,
} from "@/src/lib/retail/domain/schemas";
import { createClient } from "@/src/lib/retail/supabase/server";
import { validateImageUpload } from "@/src/lib/retail/files/validate-upload";
import { logEvent } from "@/src/lib/retail/logger";
import { friendlyError, redirectWithMessage, requiredString } from "@/src/lib/retail/server/actions";
import { requireWorkspace, syncRetailIdentity } from "@/src/lib/retail/server/auth/context";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";

function operationId(formData: FormData) {
  const candidate = requiredString(formData, "operation_id");
  return /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : crypto.randomUUID();
}

async function executeRpc(
  name: string,
  args: Record<string, unknown>,
  successPath: string,
  successMessage: string,
) {
  const context = await requireWorkspace();
  try {
    await syncRetailIdentity(context.user, context.user);
    await executeRetailRpc(context.user.id, name, args);
  } catch (error) {
    logEvent("error", "retail.mutation_failed", {
      rpc: name,
      workspace_id: context.workspace.id,
    });
    redirectWithMessage(successPath, "error", friendlyError(error));
  }
  revalidatePath(successPath);
  revalidatePath("/retail/workspace");
  redirectWithMessage(successPath, "success", successMessage);
}

function parseItems(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

export async function createProductAction(formData: FormData) {
  const context = await requireWorkspace();
  const { workspace, user } = context;
  const parsed = productInputSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    barcode: formData.get("barcode"),
    category_id: formData.get("category_id"),
    purchase_price: formData.get("purchase_price"),
    sale_price: formData.get("sale_price"),
    opening_quantity: formData.get("opening_quantity"),
    minimum_stock: formData.get("minimum_stock"),
    unit: formData.get("unit"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    redirectWithMessage("/retail/workspace/products", "error", "راجع بيانات المنتج والأسعار والكميات.");
  }
  const supabase = await createClient();
  const productOperation = operationId(formData);
  let imagePath: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      const detected = await validateImageUpload(image);
      imagePath = `${workspace.id}/products/${productOperation}.${detected.extension}`;
      const { error } = await supabase.storage.from("product-images").upload(imagePath, image, {
        contentType: detected.mime,
        upsert: false,
      });
      if (error) throw error;
    } catch {
      redirectWithMessage("/retail/workspace/products", "error", "صورة المنتج يجب أن تكون JPG أو PNG أو WebP وبحجم حتى 5MB.");
    }
  }
  try {
    await syncRetailIdentity(user, user);
    await executeRetailRpc(user.id, "retail_create_product", {
      target_workspace: workspace.id,
      target_operation: productOperation,
      payload: { ...parsed.data, image_path: imagePath },
      source_device: null,
    });
  } catch (error) {
    logEvent("error", "retail.product_create_failed", { workspace_id: workspace.id });
    if (imagePath) await supabase.storage.from("product-images").remove([imagePath]);
    redirectWithMessage("/retail/workspace/products", "error", friendlyError(error));
  }
  revalidatePath("/retail/workspace/products");
  revalidatePath("/retail/workspace");
  redirectWithMessage("/retail/workspace/products", "success", "تمت إضافة المنتج ورصيده الافتتاحي.");
}

export async function upsertCategoryAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const name = requiredString(formData, "name");
  if (!name || name.length > 100) redirectWithMessage("/retail/workspace/products", "error", "أدخل اسم تصنيف صحيحًا.");
  await executeRpc(
    "retail_upsert_category",
    {
      target_workspace: workspace.id,
      target_operation: operationId(formData),
      payload: { name },
      source_device: null,
    },
    "/retail/workspace/products",
    "تم حفظ التصنيف.",
  );
}

export async function createSaleAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const parsed = saleInputSchema.safeParse({
    customer_id: formData.get("customer_id"),
    items: parseItems(formData.get("items")),
    discount_total: formData.get("discount_total"),
    amount_paid: formData.get("amount_paid"),
    payment_method: formData.get("payment_method"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    redirectWithMessage("/retail/workspace/sales", "error", "راجع أصناف البيع والمبالغ قبل الحفظ.");
  }
  await executeRpc(
    "retail_create_sale",
    {
      target_workspace: workspace.id,
      target_operation: operationId(formData),
      payload: parsed.data,
      source_device: null,
    },
    "/retail/workspace/sales",
    "اكتملت الفاتورة والمخزون والصندوق كعملية واحدة.",
  );
}

export async function createPurchaseAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const parsed = purchaseInputSchema.safeParse({
    supplier_id: formData.get("supplier_id"),
    items: parseItems(formData.get("items")),
    amount_paid: formData.get("amount_paid"),
    payment_method: formData.get("payment_method"),
    supplier_reference: formData.get("supplier_reference"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    redirectWithMessage("/retail/workspace/purchases", "error", "راجع أصناف الشراء والتكلفة والمبلغ المدفوع.");
  }
  await executeRpc(
    "retail_create_purchase",
    {
      target_workspace: workspace.id,
      target_operation: operationId(formData),
      payload: parsed.data,
      source_device: null,
    },
    "/retail/workspace/purchases",
    "اكتمل الشراء وتحديث متوسط التكلفة والمخزون.",
  );
}

export async function createExpenseAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const parsed = expenseInputSchema.safeParse({
    category: formData.get("category"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    payment_method: formData.get("payment_method"),
    expense_date: formData.get("expense_date"),
  });
  if (!parsed.success) {
    redirectWithMessage("/retail/workspace/expenses", "error", "راجع مبلغ المصروف وتصنيفه وتاريخه.");
  }
  await executeRpc(
    "retail_create_expense",
    {
      target_workspace: workspace.id,
      target_operation: operationId(formData),
      payload: parsed.data,
      source_device: null,
    },
    "/retail/workspace/expenses",
    "تم تسجيل المصروف وتأثيره على الصندوق والتحليلات.",
  );
}

async function upsertParty(formData: FormData, type: "customer" | "supplier") {
  const { workspace } = await requireWorkspace();
  const parsed = partyInputSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });
  const path = type === "customer" ? "/retail/workspace/customers" : "/retail/workspace/suppliers";
  if (!parsed.success) redirectWithMessage(path, "error", "الاسم مطلوب، وتحقق من بيانات الاتصال.");
  await executeRpc(
    type === "customer" ? "retail_upsert_customer" : "retail_upsert_supplier",
    {
      target_workspace: workspace.id,
      target_operation: operationId(formData),
      payload: parsed.data,
      source_device: null,
    },
    path,
    type === "customer" ? "تم حفظ العميل." : "تم حفظ المورد.",
  );
}

export async function upsertCustomerAction(formData: FormData) {
  return upsertParty(formData, "customer");
}

export async function upsertSupplierAction(formData: FormData) {
  return upsertParty(formData, "supplier");
}

export async function adjustInventoryAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const movementType = requiredString(formData, "movement_type");
  const parsed = inventoryAdjustmentSchema.safeParse({
    movement_type: movementType,
    product_id: formData.get("product_id"),
    quantity_delta: formData.get("quantity_delta"),
    counted_quantity: formData.get("counted_quantity"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirectWithMessage("/retail/workspace/inventory", "error", "راجع نوع التسوية والكمية وسببها.");
  await executeRpc(
    "retail_adjust_inventory",
    {
      target_workspace: workspace.id,
      target_operation: operationId(formData),
      payload: parsed.data,
      source_device: null,
    },
    "/retail/workspace/inventory",
    "تمت تسوية المخزون مع حفظ السبب في السجل.",
  );
}

export async function adjustCashAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const amount = Number(formData.get("amount_delta"));
  const notes = requiredString(formData, "notes");
  if (!Number.isFinite(amount) || amount === 0 || notes.length < 3) {
    redirectWithMessage("/retail/workspace/cash", "error", "أدخل مبلغًا غير صفري وسببًا واضحًا.");
  }
  await executeRpc(
    "retail_adjust_cash",
    {
      target_workspace: workspace.id,
      target_operation: operationId(formData),
      payload: {
        amount_delta: amount,
        transaction_type: formData.get("transaction_type"),
        notes,
      },
      source_device: null,
    },
    "/retail/workspace/cash",
    "تم تحديث الصندوق مع قيد قابل للتتبع.",
  );
}

async function settleDebt(formData: FormData, type: "receivable" | "payable") {
  const { workspace } = await requireWorkspace();
  const parsed = settlementSchema.safeParse({
    ledger_id: formData.get("ledger_id"),
    amount: formData.get("amount"),
    payment_method: formData.get("payment_method"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirectWithMessage("/retail/workspace/debts", "error", "راجع مبلغ التسوية وطريقة الدفع.");
  const payload = {
    [type === "receivable" ? "receivable_id" : "payable_id"]: parsed.data.ledger_id,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_method,
    notes: parsed.data.notes,
  };
  await executeRpc(
    type === "receivable" ? "retail_collect_receivable" : "retail_pay_payable",
    {
      target_workspace: workspace.id,
      target_operation: operationId(formData),
      payload,
      source_device: null,
    },
    "/retail/workspace/debts",
    type === "receivable" ? "تم تسجيل التحصيل." : "تم تسجيل دفعة المورد.",
  );
}

export async function collectReceivableAction(formData: FormData) {
  return settleDebt(formData, "receivable");
}

export async function payPayableAction(formData: FormData) {
  return settleDebt(formData, "payable");
}
