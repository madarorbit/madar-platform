import type { IconName } from "@/components/ui/Icons";
import type { VerticalExtension } from "./verticals";

export type WorkspaceNavigationItem = {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  description?: string;
  keywords?: string[];
  orby?: boolean;
};

export type WorkspaceNavigationGroup = {
  key: "overview" | "operations" | "automation" | "management" | "account";
  label: string;
  items: WorkspaceNavigationItem[];
};

const overview: WorkspaceNavigationItem[] = [
  { key: "dashboard", href: "/workspace", label: "نظرة عامة", icon: "home", description: "المؤشرات والاختصارات اليومية", keywords: ["الرئيسية", "لوحة المعلومات"] },
  { key: "retail", href: "/retail/workspace", label: "MADAR Retail", icon: "store", description: "تشغيل التجزئة والمخزون والصندوق", keywords: ["تجزئة", "بيع", "مخزون", "صندوق"] },
  { key: "orby", href: "/workspace/orby", label: "أوربي", icon: "sparkles", description: "المساعد الذكي داخل سياق العمل", keywords: ["محادثة", "ذكاء", "تحليل"], orby: true },
  { key: "analytics", href: "/workspace/analytics", label: "التقارير والتحليلات", icon: "chart", description: "الأداء والاتجاهات والفترات", keywords: ["تقارير", "مؤشرات"] },
];

const operations: Record<VerticalExtension, WorkspaceNavigationItem[]> = {
  commerce: [
    { key: "products", href: "/workspace/products", label: "الأصناف والمنتجات", icon: "store", description: "الكتالوج والأسعار وحالة الأصناف", keywords: ["منتج", "صنف", "SKU"] },
    { key: "sales", href: "/workspace/sales", label: "المبيعات والمرتجعات", icon: "chart", description: "الحركات والإيراد والمرتجعات", keywords: ["بيع", "فاتورة"] },
    { key: "inventory", href: "/workspace/inventory", label: "المخزون", icon: "layers", description: "الأرصدة والتنبيهات والحركات", keywords: ["رصيد", "مستودع"] },
    { key: "procurement", href: "/workspace/procurement", label: "المشتريات والاستلام", icon: "briefcase", description: "أوامر الشراء والاستلام", keywords: ["شراء", "توريد"] },
    { key: "customers", href: "/workspace/customers", label: "العملاء", icon: "community", description: "العلاقات والقيمة والنشاط", keywords: ["CRM", "عميل"] },
    { key: "suppliers", href: "/workspace/suppliers", label: "الموردون", icon: "briefcase", description: "الموردون والأرصدة المستحقة", keywords: ["مورد", "توريد"] },
    { key: "expenses", href: "/workspace/expenses", label: "المصروفات", icon: "document", description: "المصروفات والتصنيفات", keywords: ["تكلفة", "صرف"] },
  ],
  food_service: [
    { key: "restaurant", href: "/workspace/restaurant", label: "تشغيل المطعم", icon: "store", description: "الطلبات والطاولات والتشغيل", keywords: ["مطعم", "طلب"] },
    { key: "inventory", href: "/workspace/inventory", label: "المكونات والمخزون", icon: "layers", description: "المكونات والأرصدة والتنبيهات", keywords: ["مكونات", "مخزون"] },
    { key: "suppliers", href: "/workspace/suppliers", label: "الموردون", icon: "briefcase", description: "الموردون والأرصدة المستحقة", keywords: ["مورد"] },
    { key: "expenses", href: "/workspace/expenses", label: "المصروفات", icon: "document", description: "مصروفات التشغيل", keywords: ["تكلفة", "صرف"] },
  ],
  hospitality: [
    { key: "hotel", href: "/workspace/hotel", label: "تشغيل الفندق", icon: "home", description: "الحجوزات والإشغال والتشغيل", keywords: ["فندق", "حجز"] },
    { key: "customers", href: "/workspace/customers", label: "النزلاء والعملاء", icon: "community", description: "ملفات النزلاء والعلاقات", keywords: ["نزيل", "عميل"] },
    { key: "expenses", href: "/workspace/expenses", label: "المصروفات", icon: "document", description: "مصروفات التشغيل", keywords: ["تكلفة", "صرف"] },
  ],
};

const automation: WorkspaceNavigationItem[] = [
  { key: "connect", href: "/workspace/connect", label: "الربط والمزامنة", icon: "layers", description: "الأنظمة المرتبطة وحالة البيانات", keywords: ["تكامل", "مزامنة", "API"] },
  { key: "tasks", href: "/workspace/tasks", label: "المهام وسير العمل", icon: "check", description: "المهام والمتابعة والتنفيذ", keywords: ["مهمة", "Workflow"] },
];

const management: WorkspaceNavigationItem[] = [
  { key: "permissions", href: "/workspace/permissions", label: "الفريق والصلاحيات", icon: "shield", description: "الأعضاء وحدود الوصول", keywords: ["فريق", "أدوار"] },
  { key: "settings", href: "/workspace/setup", label: "إعدادات النشاط", icon: "settings", description: "التخصص والمصدر والإعداد", keywords: ["إعدادات", "نشاط"] },
  { key: "activity", href: "/workspace/activity", label: "سجل النشاط", icon: "clock", description: "الأحداث والقرارات والتغييرات", keywords: ["سجل", "تدقيق"] },
];

const account: WorkspaceNavigationItem[] = [
  { key: "subscription", href: "/account/subscription", label: "الاشتراك والفوترة", icon: "document", description: "الباقة والدفع والاستهلاك", keywords: ["اشتراك", "فاتورة"] },
  { key: "support", href: "/account/support", label: "الدعم والملاحظات", icon: "help", description: "التواصل والملاحظات", keywords: ["مساعدة", "دعم"] },
];

const alwaysEnabled = new Set([
  "dashboard", "retail", "orby", "analytics", "connect", "tasks", "permissions", "settings", "activity", "subscription", "support",
]);

export function workspaceNavigationGroups(
  extension: VerticalExtension,
  enabledKeys?: readonly string[],
): WorkspaceNavigationGroup[] {
  const enabled = enabledKeys?.length ? new Set(enabledKeys) : null;
  const filter = (items: WorkspaceNavigationItem[]) =>
    enabled ? items.filter((item) => alwaysEnabled.has(item.key) || enabled.has(item.key)) : items;
  return [
    { key: "overview", label: "نظرة عامة", items: filter(overview) },
    { key: "operations", label: "التشغيل", items: filter(operations[extension]) },
    { key: "automation", label: "الربط والأتمتة", items: filter(automation) },
    { key: "management", label: "الإدارة", items: filter(management) },
    { key: "account", label: "الحساب", items: filter(account) },
  ].filter((group) => group.items.length) as WorkspaceNavigationGroup[];
}

export function workspaceNavigation(
  extension: VerticalExtension,
  enabledKeys?: readonly string[],
) {
  return workspaceNavigationGroups(extension, enabledKeys).flatMap((group) => group.items);
}

export function workspaceMobileNavigation(
  extension: VerticalExtension,
  enabledKeys?: readonly string[],
) {
  const items = workspaceNavigation(extension, enabledKeys);
  const operationKey = extension === "food_service" ? "restaurant" : extension === "hospitality" ? "hotel" : "sales";
  return ["dashboard", operationKey, "orby", "analytics"]
    .map((key) => items.find((item) => item.key === key))
    .filter(Boolean) as WorkspaceNavigationItem[];
}
