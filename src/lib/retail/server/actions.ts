import { redirect } from "next/navigation";

const KNOWN_ERRORS: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "يلزم تسجيل الدخول أولًا.",
  NOT_AUTHORIZED: "ليست لديك صلاحية لتنفيذ هذه العملية.",
  WORKSPACE_SUSPENDED: "مساحة التجارة موقوفة مؤقتًا.",
  SUBSCRIPTION_INACTIVE: "الاشتراك غير نشط.",
  SUBSCRIPTION_EXPIRED: "انتهت مدة الاشتراك. يمكنك إرسال طلب تجديد من الإعدادات.",
  INSUFFICIENT_STOCK: "الكمية المتاحة لا تكفي لإتمام البيع.",
  INSUFFICIENT_CASH_BALANCE: "رصيد الصندوق لا يكفي لهذه العملية.",
  CREDIT_SALE_NOT_ALLOWED: "البيع الآجل غير مسموح أو لم يتم اختيار عميل.",
  OPERATION_ID_CONFLICT: "تعذر تكرار العملية بنفس المعرّف.",
  ORBY_DAILY_LIMIT_REACHED: "وصلت إلى حد ORBY اليومي في خطتك.",
};

export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  for (const [code, translation] of Object.entries(KNOWN_ERRORS)) {
    if (message.includes(code)) return translation;
  }
  return "لم تكتمل العملية. لم تُحفظ أي تغييرات جزئية؛ حاول مرة أخرى.";
}

export function redirectWithMessage(
  path: string,
  kind: "success" | "error",
  message: string,
): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${kind}=${encodeURIComponent(message)}`);
}

export function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
