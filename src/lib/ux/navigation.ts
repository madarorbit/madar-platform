import type { IconName } from "@/components/ui/Icons";

export type ProductNavigationItem = {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  description?: string;
  keywords?: string[];
  orby?: boolean;
};

export type ProductNavigationGroup = {
  key: string;
  label: string;
  items: ProductNavigationItem[];
};

const adminBaseGroups: ProductNavigationGroup[] = [
  {
    key: "overview",
    label: "القيادة والمراقبة",
    items: [
      { key: "admin", href: "/admin", label: "نظرة الإدارة", icon: "home", description: "حالة المنصة والعمليات المفتوحة", keywords: ["الرئيسية", "لوحة"] },
      { key: "health", href: "/admin/system-health", label: "صحة المنصة", icon: "check", description: "الخدمات والجاهزية والتنبيهات", keywords: ["صحة", "أعطال"] },
      { key: "reports", href: "/admin/reports", label: "التقارير والإيرادات", icon: "chart", description: "الأداء المالي والتشغيلي", keywords: ["تقارير", "إيراد"] },
    ],
  },
  {
    key: "commercial",
    label: "التجارة والاشتراكات",
    items: [
      { key: "verticals", href: "/admin/verticals", label: "أنواع الأنشطة والحزم", icon: "layers", description: "القطاعات والوحدات والاستحقاقات", keywords: ["قطاع", "باقة"] },
      { key: "store", href: "/admin/store", label: "إدارة المتجر", icon: "store", description: "العروض والمنتجات الرقمية", keywords: ["متجر", "منتج"] },
      { key: "orders", href: "/admin/orders", label: "طلبات المتجر", icon: "document", description: "الطلبات والتنفيذ والتسليم", keywords: ["طلب", "شراء"] },
      { key: "payments", href: "/admin/local-payments", label: "الدفع والاشتراكات", icon: "shield", description: "المدفوعات والتجديد والموافقات", keywords: ["دفع", "اشتراك"] },
      { key: "coupons", href: "/admin/coupons", label: "القسائم", icon: "megaphone", description: "الخصومات والحملات", keywords: ["قسيمة", "خصم"] },
    ],
  },
  {
    key: "customers",
    label: "الحسابات والخدمات",
    items: [
      { key: "users", href: "/admin/users", label: "المستخدمون", icon: "community", description: "الحسابات والحالات والأدوار", keywords: ["مستخدم", "حساب"] },
      { key: "requests", href: "/admin/workspace-requests", label: "طلبات الخدمات", icon: "automation", description: "مراجعة الدفع وتفعيل أو تجديد الخدمات", keywords: ["خدمة", "طلب", "دفع"] },
      { key: "applications", href: "/admin/applications", label: "طلبات التوظيف", icon: "briefcase", description: "المرشحون وطلبات الانضمام", keywords: ["وظيفة", "توظيف"] },
    ],
  },
  {
    key: "systems",
    label: "الأنظمة والذكاء",
    items: [
      { key: "retail", href: "/admin/retail", label: "تشغيل MADAR Retail", icon: "store", description: "مؤشرات Retail التشغيلية بعد التفعيل المركزي", keywords: ["Retail", "تجزئة", "مخزون"] },
      { key: "integrations", href: "/admin/integrations", label: "الاتصالات وجودة البيانات", icon: "automation", description: "الموصلات والمزامنة والجودة", keywords: ["ربط", "تكامل"] },
      { key: "readiness", href: "/admin/integrations/readiness", label: "مختبر جاهزية الموصلات", icon: "check", description: "اختبارات القبول قبل العملاء", keywords: ["مختبر", "جاهزية"] },
      { key: "integration-audit", href: "/admin/integrations/audit", label: "تدقيق التكاملات", icon: "shield", description: "الأحداث والأخطاء وعمليات الوصول", keywords: ["تدقيق", "سجل"] },
      { key: "orby", href: "/admin/orby-os", label: "مركز ORBY OS", icon: "sparkles", description: "الحوكمة والنماذج والتشغيل", keywords: ["أوربي", "ذكاء"], orby: true },
    ],
  },
  {
    key: "content",
    label: "المحتوى والأصول",
    items: [
      { key: "design-system", href: "/admin/design-system", label: "نظام التصميم 2.0", icon: "layers", description: "كتالوج المكونات والرموز المرجعية", keywords: ["تصميم", "مكونات", "tokens"] },
      { key: "content", href: "/admin/content", label: "محتوى المنصة", icon: "document", description: "النصوص والمحتوى العام", keywords: ["محتوى", "صفحات"] },
      { key: "assets", href: "/admin/assets", label: "الأصول والوسائط", icon: "layers", description: "الصور والملفات المستخدمة", keywords: ["صورة", "ملف"] },
      { key: "files", href: "/admin/files", label: "إدارة الملفات", icon: "document", description: "الملفات الخاصة والتسليمات", keywords: ["ملفات"] },
      { key: "legacy-products", href: "/admin/products", label: "المنتجات السابقة", icon: "store", description: "سجلات V1 للرجوع فقط", keywords: ["قديم", "V1"] },
      { key: "legacy-services", href: "/admin/services", label: "الخدمات السابقة", icon: "briefcase", description: "سجلات الخدمات القديمة", keywords: ["خدمة", "قديم"] },
      { key: "legacy-categories", href: "/admin/categories", label: "التصنيفات السابقة", icon: "document", description: "تصنيفات V1 المؤرشفة", keywords: ["تصنيف", "قديم"] },
    ],
  },
];

const founderGroup: ProductNavigationGroup = {
  key: "founder",
  label: "مركز قيادة المؤسس",
  items: [
    { key: "founder", href: "/admin/founder", label: "مركز القيادة", icon: "sparkles", description: "القرارات والأولويات والمخاطر", keywords: ["مؤسس", "قيادة"] },
    { key: "founder-users", href: "/admin/founder/users", label: "تحكم الحسابات والمدوّن", icon: "user", description: "الإشراف الأعلى على الحسابات والمحتوى", keywords: ["حسابات", "مدونة"] },
    { key: "founder-workspaces", href: "/admin/founder/workspaces", label: "تحكم المساحات", icon: "layers", description: "المساحات والحالات والملكية", keywords: ["مساحات"] },
    { key: "founder-settings", href: "/admin/founder/settings", label: "إعدادات المنصة", icon: "settings", description: "المفاتيح والسياسات التشغيلية", keywords: ["إعدادات"] },
    { key: "founder-audit", href: "/admin/founder/audit", label: "سجل القرارات", icon: "shield", description: "أثر القرارات والإجراءات الحساسة", keywords: ["سجل", "تدقيق"] },
  ],
};

export function adminNavigationGroups(isFounder: boolean): ProductNavigationGroup[] {
  return isFounder ? [...adminBaseGroups, founderGroup] : adminBaseGroups;
}

export function routeMatches(pathname: string, href: string): boolean {
  const route = href.split("?")[0];
  if (route === "/admin" || route === "/workspace") return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}
